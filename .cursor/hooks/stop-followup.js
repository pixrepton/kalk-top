const chunks = [];

process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    const status = payload.status;
    const loopCount = Number(payload.loop_count || 0);

    if (status === "completed" && loopCount === 0) {
      process.stdout.write(
        JSON.stringify({
          followup_message:
            "Before finishing, ensure meaningful work is reflected in memory-bank/active-context.md and memory-bank/progress.md, and state what verification or evidence you actually ran.",
        }) + "\n",
      );
      return;
    }

    process.stdout.write("{}\n");
  } catch (error) {
    process.stdout.write("{}\n");
  }
});
