import OpenAI from "openai";
import { NextResponse } from "next/server";

import { buildDemoProposal } from "@/lib/fallback";
import { buildUserPrompt, proposalJsonSchema, systemPrompt } from "@/lib/prompt";
import type { CompanyInput, GenerateResponse, ProposalOutput } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

function normalizeInput(value: unknown): CompanyInput | null {
  if (!isStringRecord(value)) {
    return null;
  }

  return {
    companyName: value.companyName?.trim() ?? "",
    industry: value.industry?.trim() ?? "",
    companyUrl: value.companyUrl?.trim() ?? "",
    news: value.news?.trim() ?? "",
    ir: value.ir?.trim() ?? "",
    recruiting: value.recruiting?.trim() ?? "",
    csr: value.csr?.trim() ?? "",
    painPoints: value.painPoints?.trim() ?? "",
    memo: value.memo?.trim() ?? ""
  };
}

function parseProposal(text: string): ProposalOutput {
  try {
    return JSON.parse(text) as ProposalOutput;
  } catch {
    const extracted = text.match(/\{[\s\S]*\}/)?.[0];
    if (!extracted) {
      throw new Error("AIレスポンスをJSONとして解析できませんでした。");
    }

    return JSON.parse(extracted) as ProposalOutput;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = normalizeInput(body);

    if (!input) {
      return NextResponse.json(
        { error: "入力形式が正しくありません。" },
        { status: 400 }
      );
    }

    if (!input.companyName && !input.industry && !input.memo) {
      return NextResponse.json(
        { error: "企業名、業種、自由入力欄のいずれかを入力してください。" },
        { status: 400 }
      );
    }

    const model = process.env.OPENAI_MODEL || "gpt-5";

    if (!process.env.OPENAI_API_KEY) {
      const payload: GenerateResponse = {
        proposal: buildDemoProposal(input),
        demo: true,
        model: "demo",
        notice:
          "OPENAI_API_KEY が未設定のため、サンプル提案を生成しました。.env.local に API キーを設定するとAI生成に切り替わります。"
      };

      return NextResponse.json(payload);
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: buildUserPrompt(input)
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "furusato_pr_proposal",
          strict: true,
          schema: proposalJsonSchema as unknown as Record<string, unknown>
        }
      }
    });

    const proposal = parseProposal(response.output_text);
    const payload: GenerateResponse = {
      proposal,
      demo: false,
      model
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "提案生成中に予期しないエラーが発生しました。";

    return NextResponse.json(
      {
        error: message
      },
      { status: 500 }
    );
  }
}
