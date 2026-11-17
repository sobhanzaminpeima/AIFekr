/** Optional server-owned restriction for an isolated acceptance worker. */
export function flowJobFilter() {
  const jobId = process.env.VIDEO_FACTORY_FLOW_TEST_JOB_ID;
  return jobId === undefined ? {} : { jobId };
}

/** The shared scheduler leaves the fixed fixture to its dedicated runner. */
export function factoryQueueFilter(fixtureJobId?: string) {
  if (fixtureJobId !== undefined) {
    if (!fixtureJobId || fixtureJobId !== process.env.VIDEO_FACTORY_FLOW_TEST_JOB_ID) {
      throw new Error("FIXTURE_SCOPE_MISMATCH");
    }
    return { id: fixtureJobId, stage: "ASSET_GENERATION" };
  }
  const reserved = process.env.VIDEO_FACTORY_FLOW_TEST_JOB_ID;
  return reserved ? { id: { not: reserved } } : {};
}
