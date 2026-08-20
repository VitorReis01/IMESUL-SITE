import { processDueFeedbackJobs } from "../../../../../Backend.js/feedbackStore";
import { noStoreJson } from "../../../../../Backend.js/requestGuards";

const unauthorized = () => noStoreJson({ ok: false }, { status: 401 });

const isAuthorized = (request) => {
  const secret = process.env.IMEBOT_CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
};

export async function POST(request) {
  if (!isAuthorized(request)) return unauthorized();

  try {
    const result = await processDueFeedbackJobs();
    return noStoreJson(result);
  } catch {
    return noStoreJson({ ok: false }, { status: 500 });
  }
}

export const GET = POST;
