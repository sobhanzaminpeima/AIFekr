# Google Flow in the Video Factory workflow

## Importing media created in Flow

1. Create the AIFekr video project and open the storyboard. Copy the scene prompts from **Media & prompts**.
2. In Google Flow, generate the visual for a scene and download the output. Keep the scene number with the downloaded file.
3. For images, name each file `SHOT_001.png`, `SHOT_002.png`, and so on. In AIFekr, open **Media & prompts**, confirm usage rights, and upload the images in bulk or attach them to scenes individually.
4. For a clip, upload its supported MP4 file through the project asset library and select it on the corresponding timeline scene. Review its framing and timing before rendering.
5. Confirm the AIFekr estimate and render. Attached scene media takes the place of generation for that scene. The project still controls narration, subtitles and final assembly.

## Queue design for an operator

Keep scene specifications and status in AIFekr. Give the operator a per-scene queue containing the prompt, aspect ratio and an authorized reference asset. The Windows operator opens Flow, creates and downloads the media, and attaches it to the matching scene with their own AIFekr login. A completed scene is identified by the project, scene, input revision and attached asset so retrying a queue item can reuse it. Time limits, retries and spend controls belong in AIFekr. A downloaded file should pass format, size and ownership checks before attachment.

This describes an operator workflow. For unattended generation, use a documented API with its own credentials, quotas and billing. See [Google Flow Help](https://support.google.com/flow/answer/16353334), [Gemini image generation](https://ai.google.dev/gemini-api/docs/image-generation) and [Gemini video generation](https://ai.google.dev/gemini-api/docs/video).
