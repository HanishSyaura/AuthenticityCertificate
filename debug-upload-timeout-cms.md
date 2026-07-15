# Debug Session: upload-timeout-cms

Status: OPEN

## Symptom
- CMS upload video kadang-kadang gagal dengan `timeout of 300000ms exceeded`.
- User tak dapat bezakan sama ada upload masih berjalan, stuck, atau server-side transcode terlalu lama.

## Initial Hypotheses
1. Frontend Axios timeout 300s tamat sebelum backend selesai transcode dan simpan video.
2. Backend upload route berjaya terima file tetapi proses transcode mengambil masa terlalu lama untuk video tertentu.
3. Frontend tak ada progress / completion state yang cukup jelas, jadi user repeat upload dan nampak error seolah-olah upload gagal total.
4. Ada request yang berjaya upload file tetapi gagal pada response akhir, menyebabkan file wujud di disk tapi UI tetap report timeout.
5. Timeout lebih kerap berlaku bila CMS block video lama reference file yang missing, lalu user ulang upload semasa backend masih busy.

## Evidence Plan
- Inspect frontend upload timeout handling and progress behavior.
- Inspect backend upload route and transcode flow.
- Add instrumentation only around upload start/finish/error timing.
- Reproduce with tests or reason from logs, then implement minimal fix.

## Evidence Collected
- Frontend upload store had a hard request timeout of `300_000ms` for media upload.
- Backend `POST /uploads/media` performs video transcode inline before returning success.
- User screenshot shows `timeout of 300000ms exceeded`, which matches frontend timeout exactly.
- Existing server behavior can legitimately exceed 300s for some videos because upload and transcode share one request lifecycle.

## Instrumentation Added
- Server upload route now writes timing events to `.dbg/trae-debug-log-upload-timeout-cms.ndjson` for receive / transcode start / transcode done / success / fail.

## Fix Applied
- Video uploads no longer use the hard 300s Axios timeout; they wait for server completion.
- CMS inspector now switches from `Uploading… XX%` to `Processing…` once bytes are sent and server-side work is still ongoing.
- Existing "Done" and error states remain intact.

## Verification
- `npm.cmd test -- --run src/components/admin/cms/__tests__/CmsInspectorPanel.test.jsx` passed.
- `npm.cmd run build` passed.
