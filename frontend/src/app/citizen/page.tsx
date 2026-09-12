"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/services/api/client";
import { MessageSquare, ListFilter, Bot, Sparkles, ShieldCheck, ArrowRight } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

interface MessageItem {
  senderType: "CITIZEN" | "AGENT";
  content: string;
  createdAt: string;
  complaintId?: string;
}

export default function CitizenPage() {
  const toast = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<MessageItem[]>([
    {
      senderType: "AGENT",
      content:
        "Welcome to Awwaz. Tell me what civic problem you are experiencing in your area.\n\nYou can report in Urdu, Roman Urdu, or English (e.g. 'Bhai yahan 3 din se gutter overflow ho raha hai' or 'Streetlight is broken outside house 14').",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [needsLocation, setNeedsLocation] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (text: string) => {
    const now = new Date().toISOString();
    setMessages((prev) => [...prev, { senderType: "CITIZEN", content: text, createdAt: now }]);
    setIsLoading(true);

    const res = await api.sendMessage(text, conversationId);
    setIsLoading(false);

    if (res.success && res.data) {
      const data = res.data;
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }
      setNeedsLocation(Boolean(data.clarification_required));

      setMessages((prev) => [
        ...prev,
        {
          senderType: "AGENT",
          content: data.reply.text,
          createdAt: new Date().toISOString(),
          complaintId: data.complaint_id,
        },
      ]);

      if (data.complaint_id) {
        toast.success(
          "Civic Case Registered",
          `Dossier #${data.complaint_id} recorded to append-only ledger.`
        );
      }
    } else {
      const errMsg = res.error?.message || "Failed to process message";
      toast.error("Processing Error", errMsg);
      setMessages((prev) => [
        ...prev,
        {
          senderType: "AGENT",
          content: "Sorry, I encountered an issue processing that message. Please verify your connection or try rephrasing.",
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2.5rem 1.5rem 3.5rem" }}>
      {/* Header */}
      <PageHeader
        title="Citizen Civic Intake"
        subtitle="Report civic issues directly in Roman Urdu, Urdu, or English. Awwaz autonomously structures facts, links location data, and enforces municipal SLA promises."
        badge={
          <span
            className="badge"
            style={{
              background: "rgba(16, 185, 129, 0.15)",
              color: "var(--accent-primary)",
              fontWeight: 700,
            }}
          >
            AI INTAKE ONLINE
          </span>
        }
        breadcrumbs={[
          { label: "Home", href: "/citizen" },
          { label: "Interactive Intake" },
        ]}
        actions={
          <Link
            href="/citizen/complaints"
            className="btn btn-secondary"
            style={{ fontSize: "0.82rem", padding: "0.45rem 0.9rem" }}
          >
            <ListFilter size={15} />
            My Submitted Reports
          </Link>
        }
      />

      {/* Main Chat Panel */}
      <div
        className="glass-panel"
        style={{
          padding: "1.75rem",
          minHeight: "560px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {/* Chat Header Status Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "1rem",
            marginBottom: "1rem",
            borderBottom: "1px solid var(--border-subtle)",
            fontSize: "0.82rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--accent-primary)",
                boxShadow: "0 0 8px var(--accent-glow)",
              }}
            />
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              Awwaz Autonomous Intake Assistant
            </span>
            <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
              (Multi-lingual: Urdu / Roman Urdu / English)
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--text-muted)", fontSize: "0.75rem" }}>
            <ShieldCheck size={14} color="var(--accent-primary)" />
            <span>Cryptographically Verified Dossier</span>
          </div>
        </div>

        {/* Messages scroll container */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            maxHeight: "540px",
            paddingRight: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          {messages.map((m, idx) => (
            <ChatMessage
              key={idx}
              senderType={m.senderType}
              content={m.content}
              createdAt={m.createdAt}
              complaintId={m.complaintId}
            />
          ))}

          {isLoading && (
            <div
              className="animate-fade-in"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginBottom: "1.25rem",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--radius-full)",
                  background: "linear-gradient(135deg, var(--accent-primary), var(--accent-teal))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 2px 8px var(--accent-glow)",
                }}
              >
                <Bot size={18} color="#ffffff" />
              </div>
              <div
                style={{
                  padding: "0.75rem 1.15rem",
                  background: "var(--bg-nested)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--accent-primary)",
                    animation: "pulse 1.2s infinite",
                  }}
                />
                Analyzing civic issue, parsing location, and evaluating department routing...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <ChatComposer
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          needsLocation={needsLocation}
        />
      </div>
    </div>
  );
}
