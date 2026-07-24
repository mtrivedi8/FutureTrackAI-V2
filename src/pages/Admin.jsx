import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const levelColors = {
  info: "bg-muted text-muted-foreground",
  warn: "bg-yellow-500/10 text-yellow-600",
  error: "bg-destructive/10 text-destructive",
};

function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = log.detail && Object.keys(log.detail).length > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <button
        onClick={() => hasDetail && setExpanded((e) => !e)}
        className={cn("w-full flex items-start gap-3 text-left", hasDetail && "cursor-pointer")}
      >
        {hasDetail ? (
          expanded ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="secondary" className={cn("text-[10px] uppercase", levelColors[log.level])}>{log.level}</Badge>
            <span className="text-xs font-mono text-primary/80">{log.function_name}</span>
            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
              {new Date(log.created_date).toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-foreground break-words">{log.message}</p>
          {log.user_email && <p className="text-[10px] text-muted-foreground mt-0.5">{log.user_email}</p>}
        </div>
      </button>
      {expanded && hasDetail && (
        <pre className="mt-2 ml-7 text-[10px] bg-muted/50 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-words">
          {JSON.stringify(log.detail, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState("All");
  const [functionFilter, setFunctionFilter] = useState("All");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const rows = await apiClient.entities.FunctionLog.filter({}, "-created_date", 200);
    setLogs(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoadingAuth && user && user.role !== 'admin') {
      navigate('/');
      return;
    }
    if (user?.role === 'admin') loadLogs();
  }, [isLoadingAuth, user, navigate, loadLogs]);

  if (isLoadingAuth || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (user.role !== 'admin') return null;

  const functionNames = ["All", ...new Set(logs.map((l) => l.function_name))];
  const filtered = logs.filter((l) =>
    (levelFilter === "All" || l.level === levelFilter) &&
    (functionFilter === "All" || l.function_name === functionFilter)
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Edge function activity &amp; errors</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading} className="gap-2">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh
        </Button>
      </motion.div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["All", "info", "warn", "error"].map((l) => (
              <SelectItem key={l} value={l}>{l === "All" ? "All levels" : l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={functionFilter} onValueChange={setFunctionFilter}>
          <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {functionNames.map((f) => (
              <SelectItem key={f} value={f}>{f === "All" ? "All functions" : f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} entries</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((log) => <LogRow key={log.id} log={log} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">No log entries yet. They'll appear here as edge functions run (especially errors).</p>
        </div>
      )}
    </div>
  );
}
