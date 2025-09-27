from fastapi import UploadFile
from PIL import Image
from io import BytesIO
import base64


async def upload_file_to_image_obj(img_file: UploadFile) -> Image.Image:
    """
    Converts a FastAPI UploadFile object to a PIL.Image.Image object.

    Args:
        img_file (UploadFile): The UploadFile object to convert.

    Returns:
        PIL.Image.Image: The converted image object.
    """
    Image.WARN_POSSIBLE_FORMATS = True
    print(f"img_file.filename: {img_file.filename}")
    try:
        img_file_data = await img_file.read()
        img_bytes_stream = BytesIO(img_file_data)
        img = Image.open(img_bytes_stream).convert("RGB")
        return img
    except Exception as e:
        error_msg = f"There was an error converting the file to an image object: {e}"
        print(error_msg)
        raise IOError(error_msg)

def image_to_base64(image: Image.Image) -> str:
    img_bytes = BytesIO()
    image.save(img_bytes, format="PNG")
    base64_img = base64.b64encode(img_bytes.getvalue()).decode("utf-8")
    return base64_img
