# Debug Session: mobile-video-black-screen

- Status: OPEN
- Symptom: On Android/iPhone, tapping play shows a black or blank video area and playback does not start.
- Scope: Public verify page CMS video blocks.
- Constraints: Collect runtime evidence first. No business logic fix before instrumentation evidence.

## Hypotheses

1. The uploaded MP4 is still not decodable on affected mobile browsers.
2. CSS transform scaling around the video element causes black rendering on mobile/WebView.
3. The lazy activation flow leaves the video element in a stalled state after interaction.
4. The player source request is interrupted or re-mounted during playback startup.
5. Only certain uploaded files are affected, indicating content-specific failure rather than renderer failure.

## Plan

1. Add minimal instrumentation around video activation and media events.
2. Reproduce on the live/public flow and collect runtime evidence.
3. Confirm or reject each hypothesis from the observed logs.
4. Apply the smallest fix that matches the evidence.
5. Verify with post-fix behavior before cleanup.

## Evidence

- Live page `verify?epc=DA01C0000003052600000061` loads video sources successfully.
- Browser runtime inspection showed video elements reaching `readyState=4` with no media error on sampled videos.
- Runtime inspection also showed video elements nested under an ancestor with `transform: matrix(...)` in responsive rendering.
- A browser interaction attempt against the lazy-load button was intercepted by a sibling layer, consistent with transformed overlay/layout interference.

## Interim Conclusion

- Hypothesis 1: Not confirmed from current runtime evidence. Source loading and metadata parsing do occur.
- Hypothesis 2: Strongly supported. Responsive transform wrapping is the most likely cause of black/blank video rendering on mobile.
- Hypothesis 3: Possible but weaker than Hypothesis 2.
- Hypothesis 4: Possible secondary factor.
- Hypothesis 5: Less likely as primary cause after observing multiple videos under the same transformed layout pattern.

## Applied Change

- Added temporary video event instrumentation in `frontend/src/components/PublicRenderer.jsx`.
- Moved responsive `video` blocks out of the transformed layout layer and rendered them in a scaled absolute overlay instead.

## Next Step

- User to verify on the affected Android/iPhone path after deploying the updated frontend build.
