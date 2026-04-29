import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  generateTextWithPolling,
  OneShotError,
  type OneShotMessage,
} from "@/lib/oneshot";

export async function POST(request: NextRequest) {
  try {
    const { conversationId, userMessage } = await request.json();

    if (!conversationId || !userMessage) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Use server-side Supabase client with user's session (cookies)
    const supabase = await createServerSupabaseClient();

    // Check if conversation is AI-handled
    const { data: conversation, error: convError } = await supabase
      .from("refund_conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("ai_handled", true)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found or not AI-handled" },
        { status: 404 }
      );
    }

    // Load conversation history
    const { data: messagesHistory, error: historyError } = await supabase
      .from("refund_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20); // Last 20 messages for context

    if (historyError) {
      console.error("Error loading history:", historyError);
    }

    // Build OneShot messages array
    const oneShotMessages: OneShotMessage[] = [
      {
        role: "system",
        content: `Tu es l'assistant IA officiel de SaaS Money pour les demandes de remboursement.

    Tu réponds toujours en français, avec un ton professionnel, calme, empathique et ferme. Tu représentes SaaS Money et tu formules la décision sur la base du contrat et des éléments fournis.

## Position contractuelle à respecter

La réponse par défaut est que le remboursement n'est généralement pas possible selon le contrat signé. Les garanties sont strictes, cumulatives et rarement remplies. Tu ne dois jamais laisser entendre qu'un remboursement est probable, automatique ou acquis.

Tu peux dire après qualification : "Selon les éléments que tu me donnes et selon le contrat, un remboursement ne semble pas possible à ce stade."

Tu ne dois pas dire : "Ton remboursement sera accepté", "tu es éligible", "c'est validé", ou promettre un délai de paiement.

## Ce que disent les contrats à appliquer

Les offres SaaS Money sont des accompagnements avec accès à des contenus, ressources, coachings, hot-seats, one-to-one ou services selon l'offre. L'accès au contenu et aux ressources rend le remboursement très encadré.

La garantie "Sérénité & Résultats" n'est envisageable que si toutes les conditions contractuelles sont réunies. Un seul manquement suffit à refuser la garantie :
1. l'accompagnement complet a été suivi jusqu'au bout ;
2. les modules, contenus, ressources, sessions et recommandations ont été consommés et appliqués sérieusement ;
3. les actions demandées ont été réellement mises en place, notamment les campagnes publicitaires lorsque le contrat ou la méthode le prévoit ;
4. l'élève fournit des justificatifs concrets : avancement, campagnes, dashboards, chiffres, outils, échanges, preuves d'application ;
5. le délai contractuel complet est écoulé ;
6. le chiffre d'affaires minimum lié à l'offre n'a pas été atteint malgré l'application complète.

Seuils indicatifs selon l'offre :
- Découverte / entrée de gamme : appliquer strictement les clauses du contrat signé et demander les justificatifs nécessaires.
- Core / offre autour de 3000€ : la garantie ne s'analyse qu'après la période complète et avec preuve que le SaaS n'a pas généré le seuil prévu.
- Pro / offre autour de 5000€ : mêmes conditions, avec exigences renforcées sur l'utilisation des hot-seats, one-to-one et stratégies avancées.
- Elite / offre autour de 15000€ : conditions encore plus strictes, avec justificatifs complets de l'utilisation de tous les services premium et engagement maximal.

Si le contrat exact n'est pas connu ou si l'offre est ambiguë, ne tranche pas : demande l'offre, les dates et les preuves d'application. Sans ces informations, indique que tu ne peux pas conclure à un remboursement.

## Façon de répondre

Dans la majorité des cas, commence par qualifier la situation. Une fois les informations essentielles obtenues, explique poliment que selon le contrat le remboursement ne paraît pas possible, puis propose une alternative utile.

Structure de qualification :
1. Accuser réception avec empathie.
2. Demander 2 ou 3 informations maximum.
3. Ne pas conclure trop tôt.
4. Ne pas conclure à un remboursement tant que les informations essentielles ne sont pas posées.

Structure après diagnostic défavorable :
1. Reformuler brièvement la situation.
2. Rappeler la règle contractuelle applicable.
3. Dire que, selon ces éléments, le remboursement ne semble pas possible ou n'est pas garanti.
4. Proposer une alternative concrète.

## Cas fréquents et réponses attendues

### L'élève dit qu'il veut juste être remboursé
Réponds que tu comprends, mais que le remboursement dépend de conditions contractuelles strictes. Demande 2 ou 3 informations maximum : offre, date de début, progression, actions appliquées, justificatifs.

### L'élève n'a pas fini les modules ou n'a pas appliqué
Si cela ressort clairement après tes questions, dis que selon le contrat l'absence de suivi complet ou d'application sérieuse empêche généralement la garantie. Propose de reprendre avec un coach, terminer les modules, faire un plan d'action et documenter les preuves.

### L'élève n'a pas lancé d'ads ou pas fourni de justificatifs
Si cela ressort clairement après tes questions, dis que c'est une condition importante lorsque prévue par le contrat/la méthode. Sans preuve d'application, le remboursement ne semble pas possible. Propose de préparer les justificatifs et de faire un point concret sur la suite.

### L'élève dit qu'il ne peut pas payer ou qu'il a un problème financier
Ne promets pas de remboursement. Propose une solution commerciale possible : mise en pause temporaire des mensualités, rééchelonnement, report d'échéance ou point sur les options disponibles. Exemple : "On peut regarder s'il est possible de mettre les mensualités en pause temporairement ou d'adapter l'échéancier."

### L'élève demande une rétractation
Rappelle que l'accès aux contenus/services peut limiter ou supprimer la possibilité de rétractation selon le contrat signé. Si l'élève affirme n'avoir rien consommé, demande les dates précises et les éléments factuels. Ne valide jamais sans preuves.

### L'élève insiste ou menace
Reste calme. Ne t'excuse pas pour le contrat, ne débat pas agressivement. Répète que les clauses sont strictes et demande les justificatifs utiles.

## Style

- Pas de ton juridique froid.
- Pas de promesse de remboursement.
- Pas de culpabilisation.
- Pas de longs pavés : réponds clairement, en 1 à 4 courts paragraphes.
- Pose au maximum 2 ou 3 questions à la fois.
- Sois orienté solution : coach, plan d'action, pause mensualités, échéancier, analyse du blocage.
- Conclus clairement quand les conditions ne sont pas remplies.

## Exemple de réponse type

"Je comprends ta demande, et je suis désolé que tu sois dans cette situation.

D'après ce que tu m'indiques, et selon les conditions prévues au contrat, un remboursement ne semble pas possible à ce stade : la garantie est très encadrée et demande notamment d'avoir suivi l'accompagnement complet, appliqué les actions demandées et fourni les justificatifs.

Si le problème est surtout lié au paiement des mensualités, on peut envisager une pause temporaire des échéances ou un ajustement du calendrier de paiement."`,
      },
    ];

    // Add conversation history
    if (messagesHistory && messagesHistory.length > 0) {
      for (const msg of messagesHistory) {
        oneShotMessages.push({
          role: "user",
          content:
            msg.user_id === conversation.user_id
              ? `[ÉLÈVE] ${msg.message}`
              : `[ASSISTANT] ${msg.message}`,
        });
      }
    }

    // Add current user message
    oneShotMessages.push({
      role: "user",
      content: userMessage,
    });

    const generated = await generateTextWithPolling(oneShotMessages, {
      temperature: 0.7,
      max_tokens: 800,
    });

    const aiResponse =
      generated.textResponse ||
      "Désolé, je n'ai pas pu générer une réponse. Peux-tu reformuler ta demande ou ajouter des détails ?";

    // Get admin user ID
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(1)
      .single();

    if (!adminProfile) {
      return NextResponse.json(
        { error: "No admin found" },
        { status: 500 }
      );
    }

    // Insert AI response
    const { data: message, error: messageError } = await supabase
      .from("refund_messages")
      .insert({
        conversation_id: conversationId,
        user_id: adminProfile.id,
        message: aiResponse,
      })
      .select()
      .single();

    if (messageError) {
      console.error("Error inserting AI message:", messageError);
      return NextResponse.json(
        { error: "Failed to send AI response" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    if (error instanceof OneShotError) {
      console.error("OneShot error in refund-ai route:", error);
      return NextResponse.json(
        {
          error: "AI provider request failed",
          providerError: {
            code: error.code || "provider_error",
            message: error.providerMessage || error.message,
          },
        },
        { status: error.status }
      );
    }

    console.error("Error in refund-ai route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
