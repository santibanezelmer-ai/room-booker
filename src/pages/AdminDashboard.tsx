import { useState, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  useReservations,
  useUpdateReservationStatus,
  useReleaseReservation,
  useApproveRecurrenceGroup,
} from "@/hooks/useReservations";
import { useMaterials, useCreateMaterial, useUpdateMaterial, useDeleteMaterial } from "@/hooks/useMaterials";
import { useAdminProfiles } from "@/hooks/useProfiles";
import { useScheduleBlocks } from "@/hooks/useScheduleBlocks";
import { useEstablishmentSettings, useUpdateEstablishmentSettings } from "@/hooks/useEstablishmentSettings";
import { supabase } from "@/integrations/supabase/client";
import WeeklySchedule from "@/components/WeeklySchedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays, ClipboardList, Package, LogOut, Monitor,
  Check, X, ChevronLeft, ChevronRight, Plus, Trash2, Edit, Clock, BookOpen,
  Users, Image, KeyRound, History, Building2, Mail, LayoutGrid, Search, Repeat, Unlock, List, CalendarRange, FileDown
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ThemeToggle from "@/components/ThemeToggle";
import { exportMonthlyCalendarPdf } from "@/lib/exportMonthPdf";
import NotificationSettingsPanel from "@/components/NotificationSettingsPanel";
import AdminReservationForm from "@/components/AdminReservationForm";


const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-status-pending text-status-pending-foreground" },
  approved: { label: "Aprobada", className: "bg-status-approved text-status-approved-foreground" },
  rejected: { label: "Rechazada", className: "bg-status-rejected text-status-rejected-foreground" },
  cancelled_by_admin: { label: "Liberada", className: "bg-muted text-muted-foreground" },
};

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Change email
  const [emailDialog, setEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Change password
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres.", variant: "destructive" });
      return;
    }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contraseña actualizada", description: "Tu contraseña ha sido cambiada exitosamente." });
      setPasswordDialog(false);
      setNewPassword("");
      setConfirmPassword("");
    }
    setPasswordLoading(false);
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Correo actualizado", description: "Se ha enviado un enlace de confirmación a tu nuevo correo electrónico." });
      setEmailDialog(false);
      setNewEmail("");
    }
    setEmailLoading(false);
  };

  const [currentDate, setCurrentDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [requestSearch, setRequestSearch] = useState("");

  // History filters
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [historyStatus, setHistoryStatus] = useState<string>("all");
  const [historySearch, setHistorySearch] = useState("");

  // Calendar view mode
  const [calendarView, setCalendarView] = useState<"week" | "month" | "list">("week");
  const [monthDate, setMonthDate] = useState(new Date());

  // Release dialog
  const [releaseDialog, setReleaseDialog] = useState(false);
  const [releaseId, setReleaseId] = useState("");
  const [releaseReason, setReleaseReason] = useState("");

  // Export PDF dialog
  const [exportPdfDialog, setExportPdfDialog] = useState(false);
  const [exportMonth, setExportMonth] = useState((new Date().getMonth() + 1).toString());
  const [exportYear, setExportYear] = useState(new Date().getFullYear().toString());

  // Reservations
  const { data: reservations, isLoading } = useReservations();
  const updateStatus = useUpdateReservationStatus();
  const releaseReservation = useReleaseReservation();
  const approveGroup = useApproveRecurrenceGroup();

  // Profiles
  const { data: profiles } = useAdminProfiles();
  const getTeacherName = (teacherId: string) => {
    const p = profiles?.find(p => p.user_id === teacherId);
    return p ? `${p.full_name} (${p.email})` : "—";
  };
  const getTeacherShortName = (teacherId: string) => {
    const p = profiles?.find(p => p.user_id === teacherId);
    return p?.full_name || "";
  };

  // Materials
  const { data: materials } = useMaterials();
  const createMaterial = useCreateMaterial();
  const updateMaterial = useUpdateMaterial();
  const deleteMaterial = useDeleteMaterial();
  const [matDialog, setMatDialog] = useState(false);
  const [editMat, setEditMat] = useState<any>(null);
  const [matName, setMatName] = useState("");
  const [matDesc, setMatDesc] = useState("");
  const [matQty, setMatQty] = useState("0");

  // Schedule blocks
  const { data: scheduleBlocks } = useScheduleBlocks();
  const [blockDialog, setBlockDialog] = useState(false);
  const [editBlock, setEditBlock] = useState<any>(null);
  const [blockNum, setBlockNum] = useState("");
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockDays, setBlockDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const DAY_LABELS = [
    { value: 1, label: "Lun" },
    { value: 2, label: "Mar" },
    { value: 3, label: "Mié" },
    { value: 4, label: "Jue" },
    { value: 5, label: "Vie" },
  ];

  const openBlockForm = (block?: any) => {
    if (block) {
      setEditBlock(block);
      setBlockNum(block.block_number.toString());
      setBlockStart(block.start_time.slice(0, 5));
      setBlockEnd(block.end_time.slice(0, 5));
      setBlockDays(block.available_days || [1, 2, 3, 4, 5]);
    } else {
      setEditBlock(null);
      const nextNum = scheduleBlocks?.length ? Math.max(...scheduleBlocks.map(b => b.block_number)) + 1 : 1;
      setBlockNum(nextNum.toString());
      setBlockStart("");
      setBlockEnd("");
      setBlockDays([1, 2, 3, 4, 5]);
    }
    setBlockDialog(true);
  };

  const saveBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editBlock) {
        const { error } = await supabase
          .from("schedule_blocks")
          .update({ block_number: parseInt(blockNum), start_time: blockStart, end_time: blockEnd, available_days: blockDays })
          .eq("id", editBlock.id);
        if (error) throw error;
        toast({ title: "Bloque actualizado" });
      } else {
        const { error } = await supabase
          .from("schedule_blocks")
          .insert({ block_number: parseInt(blockNum), start_time: blockStart, end_time: blockEnd, available_days: blockDays });
        if (error) throw error;
        toast({ title: "Bloque creado" });
      }
      queryClient.invalidateQueries({ queryKey: ["schedule_blocks"] });
      setBlockDialog(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const deleteBlock = async (id: string) => {
    if (!confirm("¿Eliminar este bloque?")) return;
    const { error } = await supabase.from("schedule_blocks").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bloque eliminado" });
      queryClient.invalidateQueries({ queryKey: ["schedule_blocks"] });
    }
  };

  const toggleDay = (day: number) => {
    setBlockDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort());
  };

  // Reject dialog
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectId, setRejectId] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");

  // Establishment settings & logo
  const { data: estSettings } = useEstablishmentSettings();
  const updateEstSettings = useUpdateEstablishmentSettings();
  const [estDialog, setEstDialog] = useState(false);
  const [estName, setEstName] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Delete user
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const res = await supabase.functions.invoke("delete-user", {
        body: { user_id: userId },
      });
      if (res.error) throw new Error(res.error.message || "Error al eliminar usuario");
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      toast({ title: "Usuario eliminado" });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setDeletingUserId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const matchesSearch = (r: any, q: string) => {
    if (!q) return true;
    const needle = q.toLowerCase().trim();
    const teacher = getTeacherShortName(r.teacher_id).toLowerCase();
    const email = profiles?.find(p => p.user_id === r.teacher_id)?.email?.toLowerCase() || "";
    return (
      r.course_name.toLowerCase().includes(needle) ||
      teacher.includes(needle) ||
      email.includes(needle) ||
      r.reservation_date.includes(needle) ||
      format(new Date(r.reservation_date + "T12:00:00"), "EEEE d MMMM yyyy", { locale: es }).toLowerCase().includes(needle)
    );
  };

  const filteredReservations = reservations
    ?.filter(r => statusFilter === "all" || r.status === statusFilter)
    ?.filter(r => matchesSearch(r, requestSearch))
    ?.slice()
    ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const historyReservations = reservations
    ?.filter(r => {
      if (historyStatus !== "all" && r.status !== historyStatus) return false;
      if (historyDateFrom && r.reservation_date < historyDateFrom) return false;
      if (historyDateTo && r.reservation_date > historyDateTo) return false;
      if (!matchesSearch(r, historySearch)) return false;
      return true;
    })
    ?.sort((a, b) => b.reservation_date.localeCompare(a.reservation_date));

  // Group pending recurrent reservations by group id for batch approve
  const pendingGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    (reservations || []).forEach((r: any) => {
      if (r.recurrence_group_id && r.status === "pending") {
        groups[r.recurrence_group_id] = groups[r.recurrence_group_id] || [];
        groups[r.recurrence_group_id].push(r);
      }
    });
    return groups;
  }, [reservations]);

  const handleApprove = async (id: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: "approved", admin_notes: null as any });
      toast({ title: "Reserva aprobada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleApproveGroup = async (groupId: string) => {
    try {
      await approveGroup.mutateAsync(groupId);
      toast({ title: "Grupo aprobado", description: "Todas las reservas pendientes del grupo fueron aprobadas." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleReject = async () => {
    try {
      await updateStatus.mutateAsync({ id: rejectId, status: "rejected", admin_notes: rejectNotes });
      toast({ title: "Reserva rechazada" });
      setRejectDialog(false);
      setRejectNotes("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRelease = async () => {
    if (!releaseReason.trim()) {
      toast({ title: "Motivo requerido", description: "Indica por qué liberas esta reserva.", variant: "destructive" });
      return;
    }
    try {
      await releaseReservation.mutateAsync({ id: releaseId, reason: releaseReason.trim() });
      toast({ title: "Reserva liberada", description: "El bloque vuelve a estar disponible." });
      setReleaseDialog(false);
      setReleaseId("");
      setReleaseReason("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteReservation = async (r: any) => {
    const teacher = getTeacherShortName(r.teacher_id) || "docente";
    if (!confirm(`¿Eliminar definitivamente la solicitud de "${r.course_name}" (${teacher}) del ${r.reservation_date}?\n\nEsta acción no se puede deshacer.`)) return;
    try {
      const { error } = await supabase.from("reservations").delete().eq("id", r.id);
      if (error) throw error;
      toast({ title: "Solicitud eliminada" });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["public_reservations"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Month view data
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const approvedByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    (reservations || []).forEach((r: any) => {
      if (r.status === "approved") {
        map[r.reservation_date] = map[r.reservation_date] || [];
        map[r.reservation_date].push(r);
      }
    });
    return map;
  }, [reservations]);

  const openMaterialForm = (mat?: any) => {
    if (mat) {
      setEditMat(mat);
      setMatName(mat.name);
      setMatDesc(mat.description || "");
      setMatQty(mat.quantity_available.toString());
    } else {
      setEditMat(null);
      setMatName("");
      setMatDesc("");
      setMatQty("0");
    }
    setMatDialog(true);
  };

  const saveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editMat) {
        await updateMaterial.mutateAsync({ id: editMat.id, name: matName, description: matDesc || undefined, quantity_available: parseInt(matQty) });
      } else {
        await createMaterial.mutateAsync({ name: matName, description: matDesc || undefined, quantity_available: parseInt(matQty) });
      }
      toast({ title: editMat ? "Material actualizado" : "Material creado" });
      setMatDialog(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };


  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `logo.${ext}`;
      await supabase.storage.from("logos").remove([filePath]);
      const { error: uploadError } = await supabase.storage.from("logos").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(filePath);
      await updateEstSettings.mutateAsync({ logo_url: urlData.publicUrl + `?t=${Date.now()}` });
      toast({ title: "Logo actualizado" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const openEstDialog = () => {
    setEstName(estSettings?.name || "Sala de Computación");
    setEstDialog(true);
  };

  const saveEstSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateEstSettings.mutateAsync({ name: estName });
      toast({ title: "Datos del establecimiento actualizados" });
      setEstDialog(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {estSettings?.logo_url ? (
              <img src={estSettings.logo_url} alt="Logo" className="h-9 w-9 rounded-xl object-cover shadow-sm ring-1 ring-border/50" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
                <Monitor className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">{estSettings?.name || "Panel de Administración"}</h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button variant="outline" size="sm" onClick={openEstDialog} className="hidden sm:flex">
              <Building2 className="h-4 w-4 mr-1" /> Establecimiento
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 sm:hidden" onClick={openEstDialog} title="Establecimiento">
              <Building2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setEmailDialog(true)} title="Cambiar correo">
              <Mail className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setPasswordDialog(true)} title="Cambiar clave">
              <KeyRound className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={signOut} title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Tabs defaultValue="requests" className="w-full">
          <TabsList className="flex-wrap bg-card border border-border shadow-sm">
            <TabsTrigger value="requests"><ClipboardList className="h-4 w-4 mr-1.5" />Solicitudes</TabsTrigger>
            <TabsTrigger value="history"><History className="h-4 w-4 mr-1.5" />Historial</TabsTrigger>
            <TabsTrigger value="schedule"><CalendarDays className="h-4 w-4 mr-1.5" />Calendario</TabsTrigger>
            <TabsTrigger value="materials"><Package className="h-4 w-4 mr-1.5" />Materiales</TabsTrigger>
            <TabsTrigger value="users"><Users className="h-4 w-4 mr-1.5" />Usuarios</TabsTrigger>
            <TabsTrigger value="blocks"><LayoutGrid className="h-4 w-4 mr-1.5" />Bloques</TabsTrigger>
            <TabsTrigger value="notifications"><Mail className="h-4 w-4 mr-1.5" />Notificaciones</TabsTrigger>

          </TabsList>

          <TabsContent value="requests" className="space-y-4">
            <Card>
              <CardContent className="p-3 flex flex-wrap items-end gap-3">
                <div className="space-y-1 flex-1 min-w-[220px]">
                  <Label className="text-xs text-muted-foreground">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={requestSearch}
                      onChange={e => setRequestSearch(e.target.value)}
                      placeholder="Profesor, curso o fecha..."
                      className="pl-8"
                      maxLength={100}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Estado</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="pending">Pendientes</SelectItem>
                      <SelectItem value="approved">Aprobadas</SelectItem>
                      <SelectItem value="rejected">Rechazadas</SelectItem>
                      <SelectItem value="cancelled_by_admin">Liberadas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Pending recurrence groups: batch approve */}
            {Object.keys(pendingGroups).length > 0 && (
              <div className="space-y-2">
                {Object.entries(pendingGroups).map(([groupId, items]) => (
                  <Card key={groupId} className="border-primary/40 bg-primary/5 shadow-sm">
                    <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 text-sm min-w-0">
                        <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                          <Repeat className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">{items[0].course_name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {getTeacherShortName(items[0].teacher_id)} · {items.length} fechas pendientes
                          </div>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handleApproveGroup(groupId)} disabled={approveGroup.isPending}>
                        <Check className="h-4 w-4 mr-1" /> Aprobar todas
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {isLoading ? (
              <p className="text-muted-foreground">Cargando...</p>
            ) : !filteredReservations?.length ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No hay solicitudes que coincidan.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const pendingTotal = filteredReservations.filter(r => r.status === "pending").length;
                  return pendingTotal > 0 && statusFilter !== "approved" && statusFilter !== "rejected" && statusFilter !== "cancelled_by_admin" ? (
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full bg-status-pending animate-pulse" />
                        {pendingTotal} {pendingTotal === 1 ? "solicitud requiere" : "solicitudes requieren"} tu revisión
                      </h3>
                    </div>
                  ) : null;
                })()}

                {filteredReservations.map(r => {
                  const status = STATUS_MAP[r.status] || STATUS_MAP.pending;
                  const isPending = r.status === "pending";
                  const teacherFull = getTeacherShortName(r.teacher_id) || "Sin nombre";
                  const teacherEmail = (() => {
                    const p = profiles?.find(p => p.user_id === r.teacher_id);
                    return p?.email || "";
                  })();
                  const initials = teacherFull
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map(s => s[0]?.toUpperCase())
                    .join("") || "?";
                  const dateObj = new Date(r.reservation_date + "T12:00:00");
                  const accent =
                    r.status === "pending" ? "border-l-status-pending" :
                    r.status === "approved" ? "border-l-status-approved" :
                    r.status === "rejected" ? "border-l-status-rejected" :
                    "border-l-muted-foreground/40";
                  return (
                    <Card
                      key={r.id}
                      className={`animate-fade-in border-l-4 ${accent} ${isPending ? "ring-1 ring-status-pending/20 shadow-sm" : ""}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-stretch gap-4">
                          {/* Date block */}
                          <div className="flex flex-col items-center justify-center rounded-lg bg-muted/40 px-3 py-2 shrink-0 min-w-[64px] border border-border">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              {format(dateObj, "EEE", { locale: es })}
                            </div>
                            <div className="text-2xl font-bold text-foreground leading-tight">
                              {format(dateObj, "d")}
                            </div>
                            <div className="text-[10px] uppercase text-muted-foreground">
                              {format(dateObj, "MMM", { locale: es })}
                            </div>
                          </div>

                          {/* Main content */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <BookOpen className="h-4 w-4 text-primary shrink-0" />
                                  <span className="font-semibold text-foreground truncate">{r.course_name}</span>
                                  <Badge className={status.className}>{status.label}</Badge>
                                  {r.recurrence_group_id && (
                                    <Badge variant="outline" className="text-[10px] gap-1">
                                      <Repeat className="h-3 w-3" />Recurrente
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>
                                    Bloque {r.block_start}{r.block_end > r.block_start ? `–${r.block_end}` : ""}
                                  </span>
                                  <span className="text-border">·</span>
                                  <span className="capitalize">{format(dateObj, "EEEE", { locale: es })}</span>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex gap-1.5 shrink-0">
                                {isPending && (
                                  <>
                                    <Button
                                      size="sm"
                                      className="bg-status-approved text-status-approved-foreground hover:bg-status-approved/90"
                                      onClick={() => handleApprove(r.id)}
                                    >
                                      <Check className="h-4 w-4 mr-1" /> Aprobar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                                      onClick={() => { setRejectId(r.id); setRejectDialog(true); }}
                                    >
                                      <X className="h-4 w-4 mr-1" /> Rechazar
                                    </Button>
                                  </>
                                )}
                                {r.status === "rejected" && (
                                  <>
                                    <Button
                                      size="sm"
                                      className="bg-status-approved text-status-approved-foreground hover:bg-status-approved/90"
                                      onClick={() => handleApprove(r.id)}
                                    >
                                      <Check className="h-4 w-4 mr-1" /> Aprobar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        try {
                                          await updateStatus.mutateAsync({ id: r.id, status: "pending", admin_notes: null as any });
                                          toast({ title: "Solicitud reabierta", description: "La reserva volvió a estado pendiente." });
                                        } catch (err: any) {
                                          toast({ title: "Error", description: err.message, variant: "destructive" });
                                        }
                                      }}
                                    >
                                      Reabrir
                                    </Button>
                                  </>
                                )}
                                {(r.status === "cancelled_by_admin") && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      try {
                                        await updateStatus.mutateAsync({ id: r.id, status: "pending", admin_notes: null as any });
                                        toast({ title: "Solicitud reabierta" });
                                      } catch (err: any) {
                                        toast({ title: "Error", description: err.message, variant: "destructive" });
                                      }
                                    }}
                                  >
                                    Reabrir
                                  </Button>
                                )}
                                {r.status === "approved" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => { setReleaseId(r.id); setReleaseReason(""); setReleaseDialog(true); }}
                                    title="Liberar reserva"
                                  >
                                    <Unlock className="h-4 w-4 mr-1" /> Liberar
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => handleDeleteReservation(r)}
                                  title="Eliminar solicitud"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Teacher */}
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-foreground truncate">{teacherFull}</div>
                                {teacherEmail && (
                                  <div className="text-xs text-muted-foreground truncate">{teacherEmail}</div>
                                )}
                              </div>
                            </div>

                            {/* Details */}
                            {(r.class_objective || r.observation || r.admin_notes || r.cancellation_reason) && (
                              <div className="rounded-md bg-muted/30 border border-border/50 p-2.5 space-y-1.5 text-sm">
                                {r.class_objective && (
                                  <p className="text-foreground/90">
                                    <span className="font-medium text-foreground">Objetivo: </span>
                                    {r.class_objective}
                                  </p>
                                )}
                                {r.observation && (
                                  <p className="text-muted-foreground">
                                    <span className="font-medium">Observación: </span>{r.observation}
                                  </p>
                                )}
                                {r.admin_notes && (
                                  <p className="text-destructive">
                                    <span className="font-medium">Nota admin: </span>{r.admin_notes}
                                  </p>
                                )}
                                {r.cancellation_reason && (
                                  <p className="text-muted-foreground">
                                    <span className="font-medium">Motivo liberación: </span>{r.cancellation_reason}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* History tab */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1 flex-1 min-w-[220px]">
                    <Label className="text-xs text-muted-foreground">Buscar</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={historySearch}
                        onChange={e => setHistorySearch(e.target.value)}
                        placeholder="Profesor, curso o fecha..."
                        className="pl-8"
                        maxLength={100}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Desde</Label>
                    <Input type="date" value={historyDateFrom} onChange={e => setHistoryDateFrom(e.target.value)} className="w-40" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Hasta</Label>
                    <Input type="date" value={historyDateTo} onChange={e => setHistoryDateTo(e.target.value)} className="w-40" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Estado</Label>
                    <Select value={historyStatus} onValueChange={setHistoryStatus}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="pending">Pendientes</SelectItem>
                        <SelectItem value="approved">Aprobadas</SelectItem>
                        <SelectItem value="rejected">Rechazadas</SelectItem>
                        <SelectItem value="cancelled_by_admin">Liberadas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setHistoryDateFrom(""); setHistoryDateTo(""); setHistoryStatus("all"); setHistorySearch(""); }}>
                    Limpiar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {isLoading ? (
              <p className="text-muted-foreground">Cargando...</p>
            ) : !historyReservations?.length ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No hay reservas en el rango seleccionado.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{historyReservations.length} reserva(s) encontrada(s)</p>
                {historyReservations.map(r => {
                  const status = STATUS_MAP[r.status] || STATUS_MAP.pending;
                  return (
                    <Card key={r.id} className="animate-fade-in">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <BookOpen className="h-4 w-4 text-primary" />
                              <span className="font-semibold text-foreground">{r.course_name}</span>
                              <Badge className={status.className}>{status.label}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              <Clock className="h-3.5 w-3.5 inline mr-1" />
                              {format(new Date(r.reservation_date + "T12:00:00"), "EEEE d 'de' MMMM yyyy", { locale: es })} — Bloque {r.block_start}{r.block_end > r.block_start ? ` a ${r.block_end}` : ""}
                            </div>
                            <div className="text-sm text-muted-foreground">Docente: {getTeacherName(r.teacher_id)}</div>
                            {r.observation && <p className="text-sm text-muted-foreground">Obs: {r.observation}</p>}
                            {r.admin_notes && <p className="text-sm text-destructive">Nota: {r.admin_notes}</p>}
                            {r.cancellation_reason && <p className="text-sm text-muted-foreground">Liberada: {r.cancellation_reason}</p>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4 mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-card rounded-xl border border-border px-3 py-2 shadow-sm">
              <div className="flex items-center gap-1">
                <Button variant={calendarView === "week" ? "default" : "ghost"} size="sm" onClick={() => setCalendarView("week")}>
                  <CalendarDays className="h-4 w-4 mr-1" /> Semana
                </Button>
                <Button variant={calendarView === "month" ? "default" : "ghost"} size="sm" onClick={() => setCalendarView("month")}>
                  <CalendarRange className="h-4 w-4 mr-1" /> Mes
                </Button>
                <Button variant={calendarView === "list" ? "default" : "ghost"} size="sm" onClick={() => setCalendarView("list")}>
                  <List className="h-4 w-4 mr-1" /> Lista
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExportMonth((monthDate.getMonth() + 1).toString());
                    setExportYear(monthDate.getFullYear().toString());
                    setExportPdfDialog(true);
                  }}
                  className="ml-1"
                  title="Exportar calendario mensual a PDF"
                >
                  <FileDown className="h-4 w-4 mr-1" /> PDF mensual
                </Button>
              </div>
              {calendarView === "week" && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-semibold text-foreground">
                    {format(weekStart, "d MMM", { locale: es })} — {format(weekEnd, "d MMM yyyy", { locale: es })}
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {calendarView === "month" && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonthDate(subMonths(monthDate, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-semibold text-foreground capitalize">
                    {format(monthDate, "MMMM yyyy", { locale: es })}
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonthDate(addMonths(monthDate, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {calendarView === "week" && <WeeklySchedule currentDate={currentDate} />}

            {calendarView === "month" && (
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="grid grid-cols-7 bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
                    <div key={d} className="px-2 py-2 text-center border-r last:border-r-0 border-border">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthDays.map(day => {
                    const ds = format(day, "yyyy-MM-dd");
                    const inMonth = isSameMonth(day, monthDate);
                    const today = isSameDay(day, new Date());
                    const items = approvedByDay[ds] || [];
                    return (
                      <div
                        key={ds}
                        className={`min-h-[88px] border-r border-b border-border last:border-r-0 p-1.5 ${inMonth ? "" : "bg-muted/20 text-muted-foreground/50"} ${today ? "bg-primary/5" : ""}`}
                      >
                        <div className={`text-[11px] font-semibold mb-1 ${today ? "text-primary" : ""}`}>{format(day, "d")}</div>
                        <div className="space-y-0.5">
                          {items.slice(0, 3).map((r: any) => (
                            <div key={r.id} className="text-[10px] bg-status-approved/15 text-foreground rounded px-1 py-0.5 truncate" title={`${r.course_name} — ${getTeacherShortName(r.teacher_id)}`}>
                              B{r.block_start}{r.block_end > r.block_start ? `-${r.block_end}` : ""} {r.course_name}
                            </div>
                          ))}
                          {items.length > 3 && (
                            <div className="text-[10px] text-muted-foreground">+{items.length - 3} más</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {calendarView === "list" && (
              <Card>
                <CardContent className="p-0">
                  {(() => {
                    const upcoming = (reservations || [])
                      .filter((r: any) => r.status === "approved" && r.reservation_date >= format(new Date(), "yyyy-MM-dd"))
                      .sort((a: any, b: any) => a.reservation_date.localeCompare(b.reservation_date) || a.block_start - b.block_start);
                    if (!upcoming.length) {
                      return <div className="py-12 text-center text-muted-foreground">No hay reservas aprobadas próximas.</div>;
                    }
                    return (
                      <div className="divide-y divide-border">
                        {upcoming.map((r: any) => (
                          <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                            <div className="text-sm font-semibold text-foreground w-32 shrink-0">
                              {format(parseISO(r.reservation_date), "EEE d MMM", { locale: es })}
                            </div>
                            <div className="text-xs text-muted-foreground w-24 shrink-0">
                              Bloque {r.block_start}{r.block_end > r.block_start ? `-${r.block_end}` : ""}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">{r.course_name}</div>
                              <div className="text-xs text-muted-foreground truncate">{getTeacherShortName(r.teacher_id)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </TabsContent>


          <TabsContent value="materials" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => openMaterialForm()}>
                <Plus className="h-4 w-4 mr-1" /> Agregar Material
              </Button>
            </div>
            {!materials?.length ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No hay materiales registrados.</CardContent></Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {materials.map(m => (
                  <Card key={m.id} className="animate-fade-in">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{m.name}</CardTitle>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openMaterialForm(m)}><Edit className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMaterial.mutate(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {m.description && <p className="text-sm text-muted-foreground mb-2">{m.description}</p>}
                      <Badge variant="secondary">Disponibles: {m.quantity_available}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Users tab */}
          <TabsContent value="users" className="space-y-4">
            {!profiles?.length ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No hay usuarios registrados.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {profiles.map(p => (
                  <Card key={p.id} className="animate-fade-in">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex-1 space-y-0.5">
                        <div className="font-medium text-foreground">{p.full_name || "Sin nombre"}</div>
                        <div className="text-sm text-muted-foreground">{p.email}</div>
                        <div className="text-xs text-muted-foreground">Registrado: {format(new Date(p.created_at), "d MMM yyyy", { locale: es })}</div>
                      </div>
                      {p.user_id !== user?.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                          disabled={deleteUser.isPending && deletingUserId === p.user_id}
                          onClick={() => {
                            if (confirm(`¿Estás seguro de eliminar a ${p.full_name || p.email}? Esta acción no se puede deshacer.`)) {
                              setDeletingUserId(p.user_id);
                              deleteUser.mutate(p.user_id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Blocks tab */}
          <TabsContent value="blocks" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => openBlockForm()}>
                <Plus className="h-4 w-4 mr-1" /> Agregar Bloque
              </Button>
            </div>
            {!scheduleBlocks?.length ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No hay bloques configurados.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {scheduleBlocks.map(b => (
                  <Card key={b.id} className="animate-fade-in">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">Bloque {b.block_number}</span>
                          <Badge variant="secondary">{b.start_time.slice(0, 5)} - {b.end_time.slice(0, 5)}</Badge>
                        </div>
                        <div className="flex gap-1">
                          {DAY_LABELS.map(d => (
                            <Badge
                              key={d.value}
                              variant={b.available_days?.includes(d.value) ? "default" : "outline"}
                              className={`text-[10px] px-1.5 ${b.available_days?.includes(d.value) ? "" : "opacity-40"}`}
                            >
                              {d.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openBlockForm(b)}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteBlock(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <NotificationSettingsPanel />
          </TabsContent>
        </Tabs>

      </main>

      {/* Reject dialog */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Rechazar Solicitud</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motivo del rechazo</Label>
              <Textarea value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} placeholder="Razón del rechazo..." rows={3} />
            </div>
            <Button onClick={handleReject} variant="destructive" className="w-full">Rechazar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Material dialog */}
      <Dialog open={matDialog} onOpenChange={setMatDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editMat ? "Editar Material" : "Nuevo Material"}</DialogTitle></DialogHeader>
          <form onSubmit={saveMaterial} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={matName} onChange={e => setMatName(e.target.value)} required placeholder="Ej: Proyector, Tablet" />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input value={matDesc} onChange={e => setMatDesc(e.target.value)} placeholder="Descripción opcional" />
            </div>
            <div className="space-y-2">
              <Label>Cantidad disponible</Label>
              <Input type="number" min="0" value={matQty} onChange={e => setMatQty(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full">{editMat ? "Actualizar" : "Crear"}</Button>
          </form>
        </DialogContent>
      </Dialog>


      {/* Email change dialog */}
      <Dialog open={emailDialog} onOpenChange={setEmailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Cambiar Correo Electrónico</DialogTitle></DialogHeader>
          <form onSubmit={handleChangeEmail} className="space-y-4">
            <div className="space-y-2">
              <Label>Correo actual</Label>
              <Input value={user?.email || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Nuevo correo electrónico</Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required placeholder="nuevo@correo.cl" />
            </div>
            <p className="text-xs text-muted-foreground">Se enviará un enlace de confirmación a ambos correos.</p>
            <Button type="submit" className="w-full" disabled={emailLoading}>
              {emailLoading ? "Actualizando..." : "Actualizar Correo"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Password change dialog */}
      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Cambiar Contraseña</DialogTitle></DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label>Nueva contraseña</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label>Confirmar contraseña</Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} placeholder="Repite la contraseña" />
            </div>
            <Button type="submit" className="w-full" disabled={passwordLoading}>
              {passwordLoading ? "Actualizando..." : "Cambiar Contraseña"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Establishment settings dialog */}
      <Dialog open={estDialog} onOpenChange={setEstDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Datos del Establecimiento</DialogTitle></DialogHeader>
          <form onSubmit={saveEstSettings} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre del establecimiento</Label>
              <Input value={estName} onChange={e => setEstName(e.target.value)} required placeholder="Ej: Escuela Básica N° 1" />
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              {estSettings?.logo_url && (
                <div className="flex justify-center mb-2">
                  <img src={estSettings.logo_url} alt="Logo actual" className="h-20 w-20 rounded-lg object-cover border border-border" />
                </div>
              )}
              <Input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploadingLogo}
              />
              {uploadingLogo && <p className="text-sm text-muted-foreground">Subiendo...</p>}
            </div>
            <Button type="submit" className="w-full">Guardar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Block dialog */}
      <Dialog open={blockDialog} onOpenChange={setBlockDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editBlock ? "Editar Bloque" : "Nuevo Bloque"}</DialogTitle></DialogHeader>
          <form onSubmit={saveBlock} className="space-y-4">
            <div className="space-y-2">
              <Label>Número de bloque</Label>
              <Input type="number" min="1" value={blockNum} onChange={e => setBlockNum(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Hora inicio</Label>
                <Input type="time" value={blockStart} onChange={e => setBlockStart(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Hora fin</Label>
                <Input type="time" value={blockEnd} onChange={e => setBlockEnd(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Días disponibles</Label>
              <div className="flex gap-3">
                {DAY_LABELS.map(d => (
                  <label key={d.value} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={blockDays.includes(d.value)} onCheckedChange={() => toggleDay(d.value)} />
                    <span className="text-sm">{d.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full">{editBlock ? "Actualizar" : "Crear"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Release reservation dialog */}
      <Dialog open={releaseDialog} onOpenChange={(o) => { setReleaseDialog(o); if (!o) { setReleaseId(""); setReleaseReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Liberar Reserva</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              La reserva se marcará como liberada y el bloque volverá a estar disponible. El docente podrá ver el motivo.
            </p>
            <div className="space-y-2">
              <Label>Motivo de la liberación</Label>
              <Textarea
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Ej: Suspensión de clases, mantenimiento de la sala, etc."
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleRelease}
              disabled={releaseReservation.isPending || !releaseReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {releaseReservation.isPending ? "Liberando..." : "Confirmar liberación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export monthly PDF dialog */}
      <Dialog open={exportPdfDialog} onOpenChange={setExportPdfDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Exportar calendario mensual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se generará un PDF con todas las reservas aprobadas del mes seleccionado, incluyendo curso, docente y objetivo de la clase.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Mes</Label>
                <Select value={exportMonth} onValueChange={setExportMonth}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }).map((_, i) => {
                      const m = (i + 1).toString();
                      const label = format(new Date(2000, i, 1), "MMMM", { locale: es });
                      return (
                        <SelectItem key={m} value={m}>
                          {label.charAt(0).toUpperCase() + label.slice(1)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Año</Label>
                <Select value={exportYear} onValueChange={setExportYear}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 6 }).map((_, i) => {
                      const y = (new Date().getFullYear() - 2 + i).toString();
                      return <SelectItem key={y} value={y}>{y}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportPdfDialog(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                const target = new Date(parseInt(exportYear), parseInt(exportMonth) - 1, 1);
                await exportMonthlyCalendarPdf({
                  monthDate: target,
                  reservations: (reservations || []) as any,
                  blocks: (scheduleBlocks || []) as any,
                  getTeacherName: getTeacherShortName,
                  establishmentName: estSettings?.name || undefined,
                  logoUrl: estSettings?.logo_url,
                });
                toast({ title: "PDF generado", description: "Se descargó el calendario mensual." });
                setExportPdfDialog(false);
              }}
            >
              <FileDown className="h-4 w-4 mr-1" /> Descargar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
