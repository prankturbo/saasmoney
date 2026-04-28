"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Send,
  MessageSquare,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  user_id: string;
  status: "open" | "resolved" | "cancelled";
  acceptance_status: "pending" | "accepted" | "refused";
  ai_handled: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
  };
  unread_count?: number;
}

interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  message: string;
  created_at: string;
  user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

function isMissingColumnError(
  error: SupabaseErrorLike | null,
  columnName: string
) {
  return (
    error?.code === "42703" ||
    error?.message?.includes(columnName) ||
    error?.details?.includes(columnName)
  );
}

function toErrorPayload(error: SupabaseErrorLike | null) {
  return {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  };
}

function getConversationErrorMessage(error: SupabaseErrorLike | null) {
  if (!error) {
    return "Impossible de créer la conversation de remboursement.";
  }

  if (error.code === "42501") {
    return "Accès refusé par les règles de sécurité Supabase (RLS). Exécutez les migrations RLS du système de remboursement.";
  }

  if (error.code === "23503") {
    return "Votre profil utilisateur est manquant en base (foreign key). Exécutez le script supabase/create-profiles.sql.";
  }

  if (error.code === "42P01") {
    return "Les tables refund_conversations/refund_messages n'existent pas. Exécutez les migrations Supabase du remboursement.";
  }

  return "Impossible d'initialiser la conversation de remboursement. Vérifiez les migrations Supabase.";
}

export default function RemboursementPage() {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = getSupabaseClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState<"open" | "resolved" | "cancelled">("open");
  const [isAiHandled, setIsAiHandled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load or create conversation
  useEffect(() => {
    const loadConversation = async () => {
      if (!user?.id) return;

      try {
        setConversationError(null);

        // Step 1: Look for an ACTIVE conversation (status = open or pending)
        const { data: activeConvs, error: convError } = await supabase
          .from("refund_conversations")
          .select("id, ai_handled, status")
          .eq("user_id", user.id)
          .in("status", ["open"])
          .order("created_at", { ascending: false })
          .limit(1);

        if (convError) {
          if (isMissingColumnError(convError, "ai_handled") || isMissingColumnError(convError, "status")) {
            // Fallback for old schema without ai_handled/status columns
            const { data: fallbackConvs, error: fallbackError } = await supabase
              .from("refund_conversations")
              .select("id")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(1);

            if (fallbackError) {
              console.error("Error loading conversation (fallback):", toErrorPayload(fallbackError));
              // No conversation at all → show closed state
              setConversationId(null);
              setConversationStatus("resolved");
              setLoading(false);
              return;
            }

            if (fallbackConvs?.[0]) {
              // Conversation exists but no status column → treat as open
              setConversationId(fallbackConvs[0].id);
              setConversationStatus("open");
              setIsAiHandled(false);
              await loadMessages(fallbackConvs[0].id);
            } else {
              setConversationId(null);
              setConversationStatus("open");
              setIsAiHandled(false);
              setMessages([]);
            }
            setLoading(false);
            return;
          }

          console.error("Error loading conversation:", toErrorPayload(convError));
          setLoading(false);
          return;
        }

        // Step 2: Active conversation found
        if (activeConvs?.[0]) {
          setConversationId(activeConvs[0].id);
          setConversationStatus((activeConvs[0].status as "open" | "resolved" | "cancelled") || "open");
          setIsAiHandled(activeConvs[0].ai_handled || false);
          await loadMessages(activeConvs[0].id);
          setLoading(false);
          return;
        }

        // Step 3: No active conversation → wait for the first message before creating one
        setConversationId(null);
        setConversationStatus("open");
        setIsAiHandled(false);
        setMessages([]);
        setLoading(false);
      } catch (err) {
        console.error("Exception:", err);
        setConversationError(
          "Impossible d'initialiser la conversation. Vérifiez la configuration Supabase."
        );
        setLoading(false);
      }
    };

    loadConversation();
  }, [user?.id, supabase]);

  // Load messages
  const loadMessages = async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from("refund_messages")
        .select(`
          *,
          user:user_id(id, name, avatar_url)
        `)
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  };

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`refund-conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "refund_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async () => {
          await loadMessages(conversationId);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "refund_conversations",
          filter: `id=eq.${conversationId}`,
        },
        (payload) => {
          const conversation = payload.new as Partial<Conversation>;
          if (conversation.status) {
            setConversationStatus(conversation.status);
          }
          if (typeof conversation.ai_handled === "boolean") {
            setIsAiHandled(conversation.ai_handled);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, supabase]);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user?.id || sending) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage(""); // Clear input immediately

    try {
      let activeConversationId = conversationId;

      if (!activeConversationId) {
        const { data: newConv, error: createError } = await supabase
          .from("refund_conversations")
          .insert({ user_id: user.id, status: "open" })
          .select("id")
          .single();

        if (createError) {
          if (!isMissingColumnError(createError, "status")) {
            throw createError;
          }

          const { data: fallbackCreate, error: fallbackCreateError } = await supabase
            .from("refund_conversations")
            .insert({ user_id: user.id })
            .select("id")
            .single();

          if (fallbackCreateError) throw fallbackCreateError;
          activeConversationId = fallbackCreate.id;
        } else {
          activeConversationId = newConv.id;
        }

        setConversationId(activeConversationId);
        setConversationStatus("open");
        setIsAiHandled(false);
      }

      // Send user message
      const { data, error } = await supabase
        .from("refund_messages")
        .insert({
          conversation_id: activeConversationId,
          user_id: user.id,
          message: messageContent,
        })
        .select(`
          *,
          user:user_id(id, name, avatar_url)
        `)
        .single();

      if (error) throw error;

      setMessages([...messages, data]);

      // If AI is handling this conversation, trigger AI response
      if (isAiHandled) {
        // Wait a bit before showing AI response
        setTimeout(async () => {
          try {
            const response = await fetch("/api/refund-ai", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                conversationId,
                userMessage: messageContent,
              }),
            });

            if (response.ok) {
              // Reload messages to get AI response
              await loadMessages(conversationId);
            }
          } catch (aiError) {
            console.error("Error getting AI response:", aiError);
          }
        }, 1000);
      }
    } catch (err) {
      console.error("Error sending message:", err);
      setConversationError(getConversationErrorMessage(err as SupabaseErrorLike));
      setNewMessage(messageContent); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-magenta animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-slide-up">
      {/* Header */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/app/settings")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Demande de remboursement</h1>
            <p className="text-gray-500 text-sm">
              {conversationStatus !== "open"
                ? "Conversation terminée"
                : isAiHandled
                ? "🤖 Conversation gérée par notre assistant IA"
                : "Conversation avec SaaS Money Admin"}
            </p>
          </div>
        </div>

        {conversationStatus !== "open" ? (
          <div className="p-4 bg-gray-100 border border-gray-200 rounded-xl text-center">
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-gray-400" />
            </div>
            <p className="font-medium text-gray-700">
              {conversationStatus === "cancelled"
                ? "Votre demande a été annulée."
                : "Votre demande a été traitée."}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Vous ne pouvez plus envoyer de messages dans cette conversation.
            </p>
          </div>
        ) : isAiHandled ? (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-800">
            <p>
              <strong>ℹ️ Information :</strong> Cette demande est actuellement gérée par notre assistant IA qui connaît les termes du contrat. Un administrateur peut intervenir si nécessaire.
            </p>
          </div>
        ) : null}

        {conversationError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
            <p>
              <strong>Erreur conversation :</strong> {conversationError}
            </p>
          </div>
        )}
      </div>

      {/* Chat container */}
      <Card className="h-[600px] flex flex-col">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucun message
              </h3>
              <p className="text-gray-500 text-sm max-w-sm">
                Commence la conversation en envoyant un message. L'équipe SaaS Money te répondra dans les plus brefs délais.
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => {
                const isCurrentUser = message.user_id === user?.id;
                const isAdmin = message.user_id !== user?.id;

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      isCurrentUser ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <Avatar
                      src={message.user?.avatar_url}
                      name={message.user?.name || "Admin"}
                      size="sm"
                    />
                    <div
                      className={cn(
                        "max-w-[70%] space-y-1",
                        isCurrentUser ? "items-end" : "items-start"
                      )}
                    >
                      <div
                        className={cn(
                          "px-4 py-2 rounded-2xl",
                          isCurrentUser
                            ? "bg-magenta text-white"
                            : isAdmin
                            ? "bg-orange-100 text-orange-900"
                            : "bg-gray-100 text-gray-900"
                        )}
                      >
                        <p className="text-sm">{message.message}</p>
                      </div>
                      <p className="text-xs text-gray-400 px-2">
                        {new Date(message.created_at).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        {conversationStatus !== "open" ? (
          <div className="p-4 border-t border-gray-200">
            <p className="text-center text-sm text-gray-400 py-3">
              Cette conversation est fermée
            </p>
          </div>
        ) : (
          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-3">
              <Input
                placeholder="Écris ton message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button
                variant="gradient"
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sending || !!conversationError}
                loading={sending}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {conversationError
                ? "La conversation n'est pas initialisée. Corrige la base Supabase puis recharge la page."
                : isAiHandled
                ? "🤖 Notre assistant IA te répondra instantanément selon les termes du contrat."
                : "Un membre de l'équipe SaaS Money te répondra dans les plus brefs délais."}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
