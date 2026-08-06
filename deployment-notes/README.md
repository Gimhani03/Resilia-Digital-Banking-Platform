# Deployment Notes

Working notes for the RESILIA Azure deployment. Two documents:

| File | Read it when |
|---|---|
| [SESSION-HANDOFF.md](SESSION-HANDOFF.md) | You are picking this up in a new session and need the current state, the exact resource names, the toolchain quirks, and every trap already hit. **Start here.** |
| [FINAL-DEPLOYMENT.md](FINAL-DEPLOYMENT.md) | You want to understand how the deployment actually works — request path, route partitioning, secrets, schema, pipeline, observability. |

Related documents at the repository root:

- `DEPLOYMENT.md` — the submission-facing document (demo walkthrough, rubric mapping)
- `DEPLOYMENT_PLAN.md` — the plan of record, and why each decision was made

> **Folder name:** requested as "deployment notes"; created as `deployment-notes`
> because a space in the path breaks enough shell and CI invocations to be worth
> avoiding.
