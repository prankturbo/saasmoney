const ONESHOT_BASE_URL = "https://api.oneshotapi.com";
const ONESHOT_CREATE_JOB_PATH = "/v1/jobs";

export type OneShotRole = "system" | "user";

export interface OneShotMessage {
  role: OneShotRole;
  content: string;
}

interface OneShotJobCreateResponse {
  id: string;
  status: string;
  model: string;
  createdAt?: string;
}

interface OneShotProviderError {
  code?: string;
  message?: string;
}

interface OneShotJobStatusResponse {
  id: string;
  status: string;
  model: string;
  result?: {
    textResponse?: string;
    modelVariant?: string;
    modelName?: string;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };
  error?: OneShotProviderError | null;
}

export class OneShotError extends Error {
  status: number;
  code?: string;
  providerMessage?: string;

  constructor(
    message: string,
    options?: {
      status?: number;
      code?: string;
      providerMessage?: string;
    }
  ) {
    super(message);
    this.name = "OneShotError";
    this.status = options?.status ?? 500;
    this.code = options?.code;
    this.providerMessage = options?.providerMessage;
  }
}

interface OneShotGenerationOptions {
  temperature?: number;
  max_tokens?: number;
  timeoutMs?: number;
  initialPollIntervalMs?: number;
  maxPollIntervalMs?: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOneShotApiKey() {
  const apiKey = process.env.ONESHOT_API_KEY;

  if (!apiKey) {
    throw new OneShotError("OneShot API key is not configured", {
      status: 500,
      code: "missing_auth",
      providerMessage: "Missing ONESHOT_API_KEY",
    });
  }

  return apiKey;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringField(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const field = value[key];
  return typeof field === "string" ? field : undefined;
}

function mapProviderStatusToAppStatus(status: number) {
  if (status === 401 || status === 403) {
    return 500;
  }

  if (status === 429) {
    return 503;
  }

  if (status >= 500) {
    return 502;
  }

  return 502;
}

async function parseProviderError(response: Response) {
  const fallbackMessage = `OneShot request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as unknown;
    const errorObject = isRecord(body) && isRecord(body.error) ? body.error : undefined;

    const code =
      getStringField(errorObject, "code") ??
      getStringField(body, "code") ??
      `http_${response.status}`;

    const message =
      getStringField(errorObject, "message") ??
      getStringField(body, "message") ??
      fallbackMessage;

    return { code, message };
  } catch {
    return {
      code: `http_${response.status}`,
      message: fallbackMessage,
    };
  }
}

export async function createGeminiJob(
  messages: OneShotMessage[],
  options?: {
    temperature?: number;
    max_tokens?: number;
  }
) {
  if (!messages.length || !messages.some((message) => message.role === "user")) {
    throw new OneShotError("At least one user message is required", {
      status: 400,
      code: "validation_error",
      providerMessage: "messages must include at least one user role",
    });
  }

  const payload: {
    model: "gemini-2.5";
    messages: OneShotMessage[];
    temperature?: number;
    max_tokens?: number;
    options: {
      modelVariant: "flash";
    };
  } = {
    model: "gemini-2.5",
    messages,
    options: {
      modelVariant: "flash",
    },
  };

  if (typeof options?.temperature === "number") {
    payload.temperature = options.temperature;
  }

  if (typeof options?.max_tokens === "number") {
    payload.max_tokens = options.max_tokens;
  }

  const response = await fetch(`${ONESHOT_BASE_URL}${ONESHOT_CREATE_JOB_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getOneShotApiKey(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const providerError = await parseProviderError(response);

    throw new OneShotError("Failed to create OneShot job", {
      status: mapProviderStatusToAppStatus(response.status),
      code: providerError.code,
      providerMessage: providerError.message,
    });
  }

  const data = (await response.json()) as OneShotJobCreateResponse;

  if (!data?.id) {
    throw new OneShotError("OneShot create job response is invalid", {
      status: 502,
      code: "invalid_response",
      providerMessage: "Missing job id in create response",
    });
  }

  return data;
}

export async function getOneShotJobStatus(jobId: string) {
  const response = await fetch(`${ONESHOT_BASE_URL}${ONESHOT_CREATE_JOB_PATH}/${jobId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getOneShotApiKey(),
    },
  });

  if (!response.ok) {
    const providerError = await parseProviderError(response);

    throw new OneShotError("Failed to retrieve OneShot job status", {
      status: mapProviderStatusToAppStatus(response.status),
      code: providerError.code,
      providerMessage: providerError.message,
    });
  }

  return (await response.json()) as OneShotJobStatusResponse;
}

export async function generateTextWithPolling(
  messages: OneShotMessage[],
  options?: OneShotGenerationOptions
) {
  const timeoutMs = options?.timeoutMs ?? 60000;
  const maxPollIntervalMs = options?.maxPollIntervalMs ?? 5000;
  const initialPollIntervalMs = options?.initialPollIntervalMs ?? 2000;

  const createdJob = await createGeminiJob(messages, {
    temperature: options?.temperature,
    max_tokens: options?.max_tokens,
  });

  const startedAt = Date.now();
  let pollIntervalMs = initialPollIntervalMs;

  while (Date.now() - startedAt < timeoutMs) {
    const jobStatus = await getOneShotJobStatus(createdJob.id);

    if (jobStatus.status === "completed") {
      const textResponse = jobStatus.result?.textResponse?.trim();

      if (!textResponse) {
        throw new OneShotError("OneShot job completed without text response", {
          status: 502,
          code: "invalid_response",
          providerMessage: "Missing result.textResponse",
        });
      }

      return {
        textResponse,
        jobId: createdJob.id,
        status: jobStatus,
      };
    }

    if (jobStatus.status === "failed") {
      throw new OneShotError("OneShot job failed", {
        status: 502,
        code: jobStatus.error?.code ?? "job_failed",
        providerMessage: jobStatus.error?.message ?? "Job failed without provider message",
      });
    }

    await sleep(pollIntervalMs);
    pollIntervalMs = Math.min(pollIntervalMs + 1000, maxPollIntervalMs);
  }

  throw new OneShotError("OneShot polling timeout", {
    status: 504,
    code: "job_timeout",
    providerMessage: `Job did not complete within ${timeoutMs}ms`,
  });
}
