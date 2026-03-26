import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useReservations, useUpdateReservationStatus } from "@/hooks/useReservations";
import { useMaterials, useCreateMaterial, useUpdateMaterial, useDeleteMaterial } from "@/hooks/useMaterials";
import { useProfiles } from "@/hooks/useProfiles";
import { useScheduleSettings } from "@/hooks/useScheduleSettings";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays, ClipboardList, Package, Settings, LogOut, Monitor,
  Check, X, ChevronLeft, ChevronRight, Plus, Trash2, Edit, Clock, BookOpen,
  Users, Upload, Image, KeyRound
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-status-pending text-status-pending-foreground" },
  approved: { label: "Aprobada", className: "bg-status-approved text-status-approved-foreground" },
  rejected: { label: "Rechazada", className: "bg-status-rejected text-status-rejected-foreground" },
};

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Change email
  const [emailDialog, setEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

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

  // Reservations
  const { data: reservations, isLoading } = useReservations();
  const updateStatus = useUpdateReservationStatus();

  // Profiles
  const { data: profiles } = useProfiles();
  const getTeacherName = (teacherId: string) => {
    const p = profiles?.find(p => p.user_id === teacherId);
    return p ? `${p.full_name} (${p.email})` : "—";
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

  // Settings
  const { data: settings } = useScheduleSettings();
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [sStart, setSStart] = useState("");
  const [sEnd, setSEnd] = useState("");
  const [sDuration, setSDuration] = useState("");
  const [sDouble, setSDouble] = useState(true);

  // Reject dialog
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectId, setRejectId] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");

  // Establishment settings & logo
  const { data: estSettings } = useEstablishmentSettings();
  const updateEstSettings = useUpdateEstablishmentSettings();
  const [logoDialog, setLogoDialog] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Delete user
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
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

  const filteredReservations = reservations?.filter(
    r => statusFilter === "all" || r.status === statusFilter
  );

  const handleApprove = async (id: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: "approved" });
      toast({ title: "Reserva aprobada" });
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

  const openSettings = () => {
    if (settings) {
      setSStart(settings.start_time.slice(0, 5));
      setSEnd(settings.end_time.slice(0, 5));
      setSDuration(settings.block_duration_minutes.toString());
      setSDouble(settings.allow_double_blocks);
    }
    setSettingsDialog(true);
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    const { error } = await supabase
      .from("schedule_settings")
      .update({ start_time: sStart, end_time: sEnd, block_duration_minutes: parseInt(sDuration), allow_double_blocks: sDouble })
      .eq("id", settings.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configuración guardada" });
      queryClient.invalidateQueries({ queryKey: ["schedule_settings"] });
      setSettingsDialog(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `logo.${ext}`;
      
      // Remove old logo if exists
      await supabase.storage.from("logos").remove([filePath]);
      
      const { error: uploadError } = await supabase.storage.from("logos").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(filePath);
      await updateEstSettings.mutateAsync({ logo_url: urlData.publicUrl + `?t=${Date.now()}` });
      toast({ title: "Logo actualizado" });
      setLogoDialog(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {estSettings?.logo_url ? (
              <img src={estSettings.logo_url} alt="Logo" className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Monitor className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-foreground">Panel de Administración</h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setLogoDialog(true)}>
              <Image className="h-4 w-4 mr-1" /> Logo
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEmailDialog(true)}>
              Cambiar Correo
            </Button>
            <Button variant="outline" size="sm" onClick={openSettings}>
              <Settings className="h-4 w-4 mr-1" /> Configuración
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Tabs defaultValue="requests" className="w-full">
          <TabsList>
            <TabsTrigger value="requests"><ClipboardList className="h-4 w-4 mr-1.5" />Solicitudes</TabsTrigger>
            <TabsTrigger value="schedule"><CalendarDays className="h-4 w-4 mr-1.5" />Calendario</TabsTrigger>
            <TabsTrigger value="materials"><Package className="h-4 w-4 mr-1.5" />Materiales</TabsTrigger>
            <TabsTrigger value="users"><Users className="h-4 w-4 mr-1.5" />Usuarios</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Filtrar:</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="approved">Aprobadas</SelectItem>
                  <SelectItem value="rejected">Rechazadas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <p className="text-muted-foreground">Cargando...</p>
            ) : !filteredReservations?.length ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No hay solicitudes.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {filteredReservations.map(r => {
                  const status = STATUS_MAP[r.status] || STATUS_MAP.pending;
                  return (
                    <Card key={r.id} className="animate-fade-in">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4 text-primary" />
                              <span className="font-semibold text-foreground">{r.course_name}</span>
                              <Badge className={status.className}>{status.label}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              <Clock className="h-3.5 w-3.5 inline mr-1" />
                              {format(new Date(r.reservation_date + "T12:00:00"), "EEEE d 'de' MMMM", { locale: es })} — Bloque {r.block_start}{r.block_end > r.block_start ? ` a ${r.block_end}` : ""}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Docente: {getTeacherName(r.teacher_id)}
                            </div>
                            {r.observation && <p className="text-sm text-muted-foreground">Obs: {r.observation}</p>}
                            {r.admin_notes && <p className="text-sm text-destructive">Nota admin: {r.admin_notes}</p>}
                          </div>
                          {r.status === "pending" && (
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="outline" className="text-status-available border-status-available hover:bg-status-available hover:text-status-available-foreground" onClick={() => handleApprove(r.id)}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => { setRejectId(r.id); setRejectDialog(true); }}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-foreground">
                {format(weekStart, "d MMM", { locale: es })} — {format(weekEnd, "d MMM yyyy", { locale: es })}
              </span>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <WeeklySchedule currentDate={currentDate} />
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

      {/* Settings dialog */}
      <Dialog open={settingsDialog} onOpenChange={setSettingsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Configuración de Horario</DialogTitle></DialogHeader>
          <form onSubmit={saveSettings} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Hora inicio</Label>
                <Input type="time" value={sStart} onChange={e => setSStart(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Hora término</Label>
                <Input type="time" value={sEnd} onChange={e => setSEnd(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Duración de bloque (minutos)</Label>
              <Input type="number" min="15" max="120" value={sDuration} onChange={e => setSDuration(e.target.value)} required />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="double" checked={sDouble} onChange={e => setSDouble(e.target.checked)} className="rounded" />
              <Label htmlFor="double">Permitir bloques dobles</Label>
            </div>
            <Button type="submit" className="w-full">Guardar</Button>
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

      {/* Logo upload dialog */}
      <Dialog open={logoDialog} onOpenChange={setLogoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Logo del Establecimiento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {estSettings?.logo_url && (
              <div className="flex justify-center">
                <img src={estSettings.logo_url} alt="Logo actual" className="h-24 w-24 rounded-lg object-cover border border-border" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Subir nuevo logo</Label>
              <Input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploadingLogo}
              />
            </div>
            {uploadingLogo && <p className="text-sm text-muted-foreground">Subiendo...</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
