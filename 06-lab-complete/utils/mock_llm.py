"""Mock LLM for offline/local testing."""
import random
import time


MOCK_RESPONSES = {
    "default": [
        "This is a mock AI answer used for deployment practice.",
        "The agent is running correctly and returned a mock response.",
        "Your request reached the agent successfully.",
    ],
    "docker": ["Containers package apps so they run the same in every environment."],
    "deploy": ["Deployment is the process of shipping your app to a reachable runtime."],
    "health": ["Service is healthy and operational."],
}


def ask(question: str, delay: float = 0.1) -> str:
    time.sleep(delay + random.uniform(0, 0.05))
    lower_q = question.lower()
    for keyword, responses in MOCK_RESPONSES.items():
        if keyword in lower_q:
            return random.choice(responses)
    return random.choice(MOCK_RESPONSES["default"])
