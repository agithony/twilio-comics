import { handleVoiceTurn, type VoiceSession } from "./voice-conversation.ts";

export interface Session {
  step: "awaiting_name" | "awaiting_prompt" | "done";
  name?: string;
  prompt?: string;
  from?: string;
  callSid?: string;
}

export interface OutMsg {
  type: "text" | "end";
  token?: string;
  last?: boolean;
  handoffData?: string;
}

export interface Deps {
  publish: (job: { phoneNumber: string; prompt: string; style?: string }) => Promise<void>;
  getRemaining: (id: string) => Promise<{ remaining: number }>;
}

export async function dispatch(
  session: Session,
  msg: any,
  deps: Deps,
): Promise<{ session: Session; out: OutMsg[] }> {
  switch (msg?.type) {
    case "setup": {
      return {
        session: { ...session, from: msg.from, callSid: msg.callSid },
        out: [],
      };
    }
    case "prompt": {
      if (msg.last !== true) return { session, out: [] };
      const turn = handleVoiceTurn(
        { step: session.step, name: session.name, prompt: session.prompt } as VoiceSession,
        { voicePrompt: msg.voicePrompt || "" },
      );
      const next: Session = { ...session, ...turn.session };
      const out: OutMsg[] = [];

      if (turn.action === "enqueue_generation" && turn.session.prompt && session.from) {
        const { remaining } = await deps.getRemaining(session.from);
        if (remaining <= 0) {
          out.push({
            type: "text",
            token: "You've reached the free limit of comics for this week. Please try again in a few days. Goodbye!",
            last: true,
          });
          out.push({ type: "end", handoffData: JSON.stringify({ reason: "rate_limited" }) });
          return { session: next, out };
        }
        await deps.publish({ phoneNumber: session.from, prompt: turn.session.prompt, style: "noir" });
      }

      if (turn.say) out.push({ type: "text", token: turn.say, last: true });
      if (turn.endCall) {
        out.push({
          type: "end",
          handoffData: JSON.stringify({ name: next.name, prompt: next.prompt }),
        });
      }
      return { session: next, out };
    }
    case "error": {
      console.error("ConversationRelay error:", msg.description);
      return { session, out: [] };
    }
    default:
      return { session, out: [] };
  }
}
