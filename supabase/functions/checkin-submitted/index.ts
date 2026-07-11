import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { check_in_id } = await req.json();

    const { data: checkIn, error } = await supabase
      .from("check_ins").select("*").eq("id", check_in_id).single();
    if (error) throw error;

    // Deterministic keyword scan. Do not replace with an AI classifier — this
    // path is safety-critical and must remain auditable and low-latency.
    const crisisKeywords = ["want to give up", "can't do this anymore", "hopeless"];
    const flagged = checkIn.help_text &&
      crisisKeywords.some((kw) => checkIn.help_text.toLowerCase().includes(kw));

    if (flagged) {
      await supabase.from("crisis_alerts").insert({
        client_id: checkIn.client_id,
        check_in_id: checkIn.id,
        matched_keywords: crisisKeywords.filter((kw) =>
          checkIn.help_text.toLowerCase().includes(kw)),
      });
      await supabase.from("check_ins").update({ crisis_flag: true }).eq("id", checkIn.id);
      await supabase.functions.invoke("crisis-detected", { body: { client_id: checkIn.client_id } });
    }

    await supabase.functions.invoke("award-points", {
      body: { client_id: checkIn.client_id, activity: "check_in", points: 30, naira: 120 },
    });

    return new Response(JSON.stringify({ success: true, crisis_flagged: flagged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
