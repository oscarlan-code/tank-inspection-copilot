# Contents Classification Agent releases

## Evaluation v1

`evaluation/v1/` is the first immutable qualified evaluation release. It is the
byte-identical promotion of sandbox candidate `contents-classification-v10`, with
an audited filesystem-path relocation recorded in `release-manifest.json`.

- Release ID: `contents-classification-evaluation-v1`
- Model: `gpt-5.6-sol`
- Prompt: `classification_prompt_v10`
- Atomizer: `evidence-atomizer-v5`
- Outline: `vertical-api653-inspection-report-v6`
- Human review: required
- Generation eligibility: disabled until review seals section and block decisions
- Product use: disabled

The server-owned `release-registry.json` binds the exact manifest hash. Resolution
requires the exact release ID and `evaluation` execution mode; `latest` and product
execution fail closed. Any executable, prompt, configuration, outline, atomizer,
guard, qualification, or shared-dependency change requires a new release.
