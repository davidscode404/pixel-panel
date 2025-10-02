#!/usr/bin/env python3
"""
Test script for the generate_story function in voice_over.py
"""

import asyncio
import os
import sys
import json
from dotenv import load_dotenv

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Import the function to test
from api.voice_over import generate_story

async def test_generate_story():
    """
    Test the generate_story function with various inputs
    """
    print("🧪 Testing generate_story function...")
    print("=" * 50)
    
    # Test cases
    test_cases = [
        {
            "name": "Simple comic prompt",
            "input": "A superhero dog saving a cat from a tree",
            "expected_type": str
        },
        {
            "name": "Complex comic prompt", 
            "input": "A space adventure with aliens, robots, and a brave astronaut exploring a mysterious planet",
            "expected_type": str
        },
        {
            "name": "Short prompt",
            "input": "Cat playing with yarn",
            "expected_type": str
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📝 Test {i}: {test_case['name']}")
        print(f"Input: {test_case['input']}")
        print("-" * 30)
        
        try:
            # Call the function
            result = await generate_story(test_case['input'])
            
            # Check if result is the expected type
            if isinstance(result, test_case['expected_type']):
                print(f"✅ Type check passed: {type(result).__name__}")
            else:
                print(f"❌ Type check failed: expected {test_case['expected_type'].__name__}, got {type(result).__name__}")
            
            # Try to parse as JSON (since the function expects JSON response)
            try:
                parsed_result = json.loads(result)
                print(f"✅ JSON parsing successful")
                print(f"📄 Generated story content: {parsed_result}")
            except json.JSONDecodeError as e:
                print(f"⚠️  JSON parsing failed: {e}")
                print(f"📄 Raw result: {result}")
            
            print(f"✅ Test {i} completed successfully")
            
        except Exception as e:
            print(f"❌ Test {i} failed with error: {e}")
            print(f"Error type: {type(e).__name__}")
            
            # Print more detailed error information
            import traceback
            print("Full traceback:")
            traceback.print_exc()
    
    print("\n" + "=" * 50)
    print("🏁 Testing completed!")

async def test_environment_setup():
    """
    Test if the required environment variables are set
    """
    print("🔧 Checking environment setup...")
    
    required_vars = ["GOOGLE_API_KEY"]
    missing_vars = []
    
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
            print(f"❌ Missing environment variable: {var}")
        else:
            print(f"✅ Environment variable {var} is set")
    
    if missing_vars:
        print(f"\n⚠️  Missing required environment variables: {missing_vars}")
        print("Please set these variables in your .env file or environment")
        return False
    else:
        print("✅ All required environment variables are set")
        return True

async def main():
    """
    Main test function
    """
    print("🚀 Starting voice_over.py test suite")
    print("=" * 50)
    
    # Check environment setup first
    env_ok = await test_environment_setup()
    
    if not env_ok:
        print("\n❌ Environment setup failed. Please fix the missing variables and try again.")
        return
    
    print("\n" + "=" * 50)
    
    # Run the main tests
    await test_generate_story()

if __name__ == "__main__":
    # Run the async test
    asyncio.run(main())
