import requests
import json
from datetime import datetime, timedelta

INSFORGE_URL = "https://c8kd4983.us-east.insforge.app"
API_KEY = "ik_df331b0b56cf128dd6515e7c3b714b59"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def scrape_scholarships():
    print("Agent: Starting Autonomous Web Research for Scholarships...")
    
    # In a full deployment, this would use Playwright/Selenium to scrape NSP, AICTE, etc.
    # For this architecture setup, we simulate the structured scraped data.
    simulated_data = [
        {
            "name": "AICTE Pragati Scholarship for Girls",
            "deadline": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            "eligibility": "Girls taking admission in AICTE approved Technical Institution for Degree/Diploma.",
            "link": "https://scholarships.gov.in/",
            "source": "AICTE"
        },
        {
            "name": "Reliance Foundation Undergraduate Scholarship",
            "deadline": (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d"),
            "eligibility": "First year undergraduate students with family income < 15 Lakhs.",
            "link": "https://scholarships.reliancefoundation.org/",
            "source": "Reliance Foundation"
        }
    ]
    
    print(f"Agent: Found {len(simulated_data)} scholarships. Inserting into InsForge Database...")
    
    response = requests.post(
        f"{INSFORGE_URL}/rest/v1/scholarships",
        headers=headers,
        json=simulated_data
    )
    
    if response.status_code in [200, 201]:
        print("Successfully inserted data into InsForge!")
        for item in response.json():
            print(f" - {item['name']}")
    else:
        print(f"Error inserting data: {response.text}")

if __name__ == "__main__":
    scrape_scholarships()
