import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MapPin, CalendarClock, ExternalLink, Mail, Compass, Copy, Send, CreditCard, Trophy } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/api/apiClient";

const statusColors = {
  "New": "bg-muted text-muted-foreground",
  "Applied": "bg-primary/10 text-primary",
  "Interviewing": "bg-secondary/10 text-secondary",
  "Accepted": "bg-green-500/10 text-green-600",
  "Rejected": "bg-destructive/10 text-destructive",
  "Skipped": "bg-muted text-muted-foreground",
};

const selectivityColors = {
  "Open": "bg-green-500/10 text-green-600",
  "Competitive": "bg-blue-500/10 text-blue-600",
  "Selective": "bg-secondary/10 text-secondary",
  "Highly Selective": "bg-accent/10 text-accent",
};

function AdmissionModelBadges({ admissionModel }) {
  if (!admissionModel) return null;
  const showPay = admissionModel === "Pay to Play" || admissionModel === "Both";
  const showSelective = admissionModel === "Selective" || admissionModel === "Both";
  return (
    <>
      {showPay && (
        <Badge variant="secondary" className="text-[10px] gap-1 bg-yellow-500/10 text-yellow-700">
          <CreditCard className="w-2.5 h-2.5" /> Pay to Play
        </Badge>
      )}
      {showSelective && (
        <Badge variant="secondary" className="text-[10px] gap-1 bg-blue-500/10 text-blue-600">
          <Trophy className="w-2.5 h-2.5" /> Selective
        </Badge>
      )}
    </>
  );
}

function buildEmailDraft({ internship, profile }) {
  const grade = profile?.current_grade;
  const interests = (profile?.interests || []).slice(0, 3).join(", ");
  const subject = `Interest in ${internship.title}${internship.organization ? ` at ${internship.organization}` : ""}`;
  const body = `Dear ${internship.organization || "Admissions Team"},

My name is ${profile?.display_name || "[your name]"}, and I'm a${grade ? ` grade ${grade}` : ""} student${interests ? ` interested in ${interests}` : ""}. I'm very interested in ${internship.title}${internship.organization ? ` at ${internship.organization}` : ""}${internship.why_recommended ? ` because ${internship.why_recommended.charAt(0).toLowerCase()}${internship.why_recommended.slice(1)}` : "."}

I'd love to learn more about the application process and how I can be a strong candidate. Could you share any details about eligibility, timeline, or ways to prepare?

Thank you for your time and consideration.

Best regards,
${profile?.display_name || "[your name]"}${grade ? `\nGrade ${grade}` : ""}`;
  return { subject, body };
}

export default function InternshipCard({ internship, profile, onStatusChange }) {
  const [localStatus, setLocalStatus] = useState(internship.status);
  const [pathOpen, setPathOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [draft, setDraft] = useState(null);

  // Show whichever action is actually relevant for how this program is
  // pursued - a legacy record with no application_method still shows both,
  // matching the previous always-show-both behavior.
  const method = internship.application_method;
  const showApply = !!internship.application_url && method !== "Email Inquiry";
  const showCompose = method !== "Online Application";

  const updateStatus = async (s) => {
    setLocalStatus(s);
    await apiClient.entities.Internship.update(internship.id, { status: s });
    toast.success(`Marked as ${s}`);
    onStatusChange?.();
  };

  const openCompose = () => {
    setDraft(buildEmailDraft({ internship, profile }));
    setEmailOpen(true);
  };

  const sendViaMailClient = () => {
    const to = internship.contact_email || "";
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
    window.location.href = url;
  };

  const copyDraft = async () => {
    await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="rounded-2xl bg-card border border-border p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 flex flex-col h-full">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-heading font-semibold text-foreground">{internship.organization || "Organization"}</h3>
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          {internship.selectivity && (
            <Badge variant="secondary" className={cn("text-[10px]", selectivityColors[internship.selectivity])}>{internship.selectivity}</Badge>
          )}
          <AdmissionModelBadges admissionModel={internship.admission_model} />
          {internship.contact_email && (
            <Badge variant="secondary" className="text-[10px] gap-1 bg-green-500/10 text-green-600"><Mail className="w-2.5 h-2.5" />Email found</Badge>
          )}
        </div>
      </div>

      {internship.application_url ? (
        <a href={internship.application_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline mb-2 inline-block">
          {internship.title}
        </a>
      ) : (
        <p className="text-sm font-medium text-foreground mb-2">{internship.title}</p>
      )}

      <p className="text-sm text-muted-foreground mb-2 flex-1">{internship.description}</p>

      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground mb-2">
        {internship.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{internship.location}</span>}
        {internship.deadline && <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" />{internship.deadline}</span>}
      </div>

      {internship.eligibility && (
        <p className="text-xs text-muted-foreground italic mb-3">{internship.eligibility}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <Badge variant="secondary" className={cn("text-[10px]", statusColors[localStatus])}>{localStatus || "New"}</Badge>
        {internship.season && <Badge variant="outline" className="text-[10px]">{internship.season}</Badge>}
        {internship.duration && <Badge variant="outline" className="text-[10px]">{internship.duration}</Badge>}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mt-auto">
        {showApply && (
          <a href={internship.application_url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 px-2">
              Apply <ExternalLink className="w-2.5 h-2.5" />
            </Button>
          </a>
        )}
        {internship.path_to_get_in && (
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 px-2" onClick={() => setPathOpen(true)}>
            <Compass className="w-3 h-3" /> Path to Get In
          </Button>
        )}
        {showCompose && (
          <Button size="sm" className="h-7 text-[10px] gap-1 px-2 bg-gradient-to-r from-primary to-accent" onClick={openCompose}>
            <Mail className="w-3 h-3" /> Compose Email
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mt-2 pt-2 border-t border-border/50">
        {["Applied", "Interviewing", "Accepted", "Rejected"].map((s) => (
          <button
            key={s}
            onClick={() => updateStatus(s)}
            className={cn(
              "text-[10px] px-2 py-1 rounded-lg border font-medium transition-colors select-none",
              localStatus === s
                ? s === "Accepted" ? "bg-green-500/20 text-green-700 border-green-300"
                  : s === "Rejected" ? "bg-destructive/20 text-destructive border-destructive/40"
                  : "bg-primary/20 text-primary border-primary/40"
                : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <Dialog open={pathOpen} onOpenChange={setPathOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Path to Get In</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{internship.path_to_get_in}</p>
        </DialogContent>
      </Dialog>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Compose Outreach Email</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              {internship.contact_email ? (
                <p className="text-xs text-muted-foreground">To: <span className="font-medium text-foreground">{internship.contact_email}</span></p>
              ) : (
                <p className="text-xs text-muted-foreground">No contact email was found for this program — copy this draft and use the program's contact/inquiry form instead.</p>
              )}
              <input
                className="w-full text-sm rounded-md border border-input bg-transparent px-3 py-2"
                value={draft.subject}
                onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
              />
              <Textarea
                rows={12}
                value={draft.body}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">This is a draft only — review and personalize it before sending. Nothing is sent automatically.</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={copyDraft} className="gap-2"><Copy className="w-3.5 h-3.5" /> Copy</Button>
            <Button size="sm" onClick={sendViaMailClient} className="gap-2 bg-gradient-to-r from-primary to-accent">
              <Send className="w-3.5 h-3.5" /> Open in Email App
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
