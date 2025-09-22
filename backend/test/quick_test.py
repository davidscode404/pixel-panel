import requests
import base64

# response = requests.post(
#     "http://localhost:8000/initial-draw", 
#     params={"description_text": "Please adjust the image to make the HKSTP golden egg look glittery."},
#     files={"drawing_file": ("golden_egg.jpg", open("C:\\Users\\maksy\\Programming Work\\ai-tinkerers-ultimate-agents-hack\\ultimate-agents\\backend\\golden_egg2.jpg", "rb"), "image/jpg")}
# )

# base64_image_data = base64.b64encode(open("C:\\Users\\maksy\\Programming Work\\ai-tinkerers-ultimate-agents-hack\\ultimate-agents\\backend\\golden_egg2.jpg", "rb").read()).decode("utf-8")
# response = requests.post(
#     "http://localhost:8000/generate",
#     json={"text_prompt": "Please adjust the image to make the HKSTP golden egg look glittery.",
#           "reference_image": base64_image_data}
# )

# response = requests.post(
#     "http://localhost:8000/generate-voiceover",
#     params={"voiceover_text": "Please adjust the image to make the HKSTP golden egg look glittery."}
# )

response = requests.post(
    "http://localhost:8000/auto-complete",
    files={"image_c1": ("golden_egg.jpg", open("C:\\Users\\maksy\\Programming Work\\ai-tinkerers-ultimate-agents-hack\\ultimate-agents\\backend\\golden_egg2.jpg", "rb"), "image/jpg")}

)
print(response.json())