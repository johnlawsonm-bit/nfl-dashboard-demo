"""
Deploys the NFL Season Projection FastAPI app (serve.py) to Modal.

The image bundles exactly the three files the app needs (serve.py,
pipeline_def.py, pipeline.joblib) and pins scikit-learn to the EXACT
version recorded in the artifact's metadata, so the unpickled Pipeline
behaves identically to how it was fit.

Deploy:
    source .venv/bin/activate
    modal deploy modal_serve.py
"""
import os

import joblib
import modal

ML_DIR = os.path.dirname(__file__)

# Read the exact sklearn version the artifact was built with, so the Modal
# image installs precisely that version rather than "whatever is latest".
_bundle_meta = joblib.load(os.path.join(ML_DIR, "pipeline.joblib"))["metadata"]
SKLEARN_VERSION = _bundle_meta["sklearn_version"]

app = modal.App("nfl-season-projection")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        f"scikit-learn=={SKLEARN_VERSION}",
        "pandas",
        "numpy",
        "joblib",
        "fastapi",
        "pydantic",
    )
    .add_local_file(os.path.join(ML_DIR, "pipeline_def.py"), "/root/pipeline_def.py")
    .add_local_file(os.path.join(ML_DIR, "pipeline.joblib"), "/root/pipeline.joblib")
    .add_local_file(os.path.join(ML_DIR, "serve.py"), "/root/serve.py")
)


@app.function(image=image)
@modal.asgi_app()
def fastapi_app():
    import sys

    sys.path.insert(0, "/root")
    os.chdir("/root")

    from serve import app as web_app  # imported inside the function, per spec

    return web_app
