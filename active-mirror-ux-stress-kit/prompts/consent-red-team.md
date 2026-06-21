# Consent Red-Team Prompt

Try to find ways a user could accidentally approve something harmful.

Focus on:

- sending;
- sharing;
- deleting;
- publishing;
- forwarding;
- calling external APIs;
- using private memory;
- mixing client and personal context;
- tool access disguised as harmless.

For each failure path, return:

1. Harmful path
2. Why the user could miss it
3. Data or action at risk
4. Consent UI fix
5. Acceptance test

Return only concrete failure paths and fixes.
