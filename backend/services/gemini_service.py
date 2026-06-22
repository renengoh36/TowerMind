import json
import re

from config import Config


PROMPT_TEMPLATE = """
You are TowerMind AI, a smart building optimisation expert.

Building Context:
- Total monthly utility cost: RM {total_cost}
- Average occupancy: {occupancy}%
- Current electricity usage: {current_usage} kWh
- Current carbon footprint: {carbon_footprint} kg CO₂e
- Number of floors: {floors}
- Peak hours: {peak_hours}

User Query:
"{user_query}"

Generate 3 optimisation scenarios.

For each scenario provide:
1. Name
2. Description
3. Estimated savings (RM)
4. Carbon reduction percentage
5. Effort level (Low, Medium, High)
6. Comfort score (0-100)
7. Timeline
8. Risk

Return JSON ONLY using this structure:

{{
  "scenario_a": {{
    "name": "",
    "description": "",
    "savings": 0,
    "carbon_reduction": 0,
    "effort": "",
    "comfort_score": 0,
    "timeline": "",
    "risk": ""
  }},
  "scenario_b": {{
    "name": "",
    "description": "",
    "savings": 0,
    "carbon_reduction": 0,
    "effort": "",
    "comfort_score": 0,
    "timeline": "",
    "risk": ""
  }},
  "scenario_c": {{
    "name": "",
    "description": "",
    "savings": 0,
    "carbon_reduction": 0,
    "effort": "",
    "comfort_score": 0,
    "timeline": "",
    "risk": ""
  }},
  "recommended": "scenario_a",
  "analysis": ""
}}
"""


class GeminiUnavailableError(Exception):
    pass


def is_configured():
    return bool(
        getattr(
            Config,
            "GEMINI_API_KEY",
            None,
        )
    )


def _extract_json(text):

    match = re.search(
        r"\{.*\}",
        text,
        re.DOTALL,
    )

    if not match:
        raise GeminiUnavailableError(
            "No JSON found in Gemini response"
        )

    return json.loads(
        match.group(0)
    )


def _validate_result(result, context):

    max_savings = (
        float(
            context.get(
                "total_cost",
                10000,
            )
        )
        * 0.30
    )

    for scenario in [
        "scenario_a",
        "scenario_b",
        "scenario_c",
    ]:

        if scenario not in result:
            continue

        item = result[scenario]

        item["savings"] = min(
            float(
                item.get(
                    "savings",
                    0,
                )
            ),
            max_savings,
        )

        item["carbon_reduction"] = max(
            0,
            min(
                float(
                    item.get(
                        "carbon_reduction",
                        0,
                    )
                ),
                100,
            ),
        )

        item["comfort_score"] = max(
            0,
            min(
                float(
                    item.get(
                        "comfort_score",
                        0,
                    )
                ),
                100,
            ),
        )

    return result


def generate_scenarios(
    user_query,
    building_context,
):

    if not is_configured():
        raise GeminiUnavailableError(
            "Gemini API key not configured"
        )

    try:
        import google.generativeai as genai

    except ImportError as e:

        raise GeminiUnavailableError(
            "google-generativeai package not installed"
        ) from e

    print("=" * 60)
    print("GEMINI DEBUG")
    print("=" * 60)
    print(
        "Gemini Key Loaded:",
        bool(Config.GEMINI_API_KEY)
    )
    print(
        "Gemini Model:",
        Config.GEMINI_MODEL
    )

    genai.configure(
        api_key=Config.GEMINI_API_KEY
    )

    model = genai.GenerativeModel(
        Config.GEMINI_MODEL
    )

    prompt = PROMPT_TEMPLATE.format(
        user_query=user_query,
        **building_context,
    )

    try:

        print("=" * 60)
        print("SENDING REQUEST TO GEMINI")
        print("=" * 60)

        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(model.generate_content, prompt)
            try:
                response = future.result(timeout=7)
            except concurrent.futures.TimeoutError:
                raise GeminiUnavailableError("Gemini API timed out after 7s")

        print("=" * 60)
        print("GEMINI RESPONSE RECEIVED")
        print("=" * 60)

        print(response.text)

        result = _extract_json(
            response.text
        )

        result = _validate_result(
            result,
            building_context,
        )

        return result

    except Exception as e:

        print("=" * 60)
        print("GEMINI ERROR")
        print("=" * 60)
        print(type(e))
        print(str(e))

        raise GeminiUnavailableError(
            str(e)
        ) from e