import requests

response = requests.post(
    "http://localhost:8000/initial-draw", 
    params={"description_text": "Please adjust the image to make the HKSTP golden egg look glittery."},
    files={"drawing_file": ("golden_egg.jpg", open("C:\\Users\\maksy\\Programming Work\\ai-tinkerers-ultimate-agents-hack\\ultimate-agents\\backend\\golden_egg2.jpg", "rb"), "image/jpg")}
)

print(response.json())