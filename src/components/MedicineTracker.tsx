import { useState } from 'react';
import { DoseTimePicker } from '@/components/DoseTimePicker';
import { currentQuarter, doseTimeFields, doseTimeValue, doseTimeLabel } from '@/lib/doseTime';
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton';
import { useMedicines, MedicineLog } from '@/hooks/useMedicines';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { changedCaregiverId } from '@/lib/caregiverChoice';
import { useCaregiverChoice } from '@/hooks/useCaregiverChoice';
import { CaregiverPicker } from '@/components/CaregiverPicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, Copy, Pill } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';

interface MedicineTrackerProps {
  viewDate: string;
}



export function MedicineTracker({ viewDate }: MedicineTrackerProps) {
  const { medicines, logs, loading, addMedicineLog, deleteMedicineLog, updateMedicineLog, addNewMedicine, copyFromPreviousDay } = useMedicines(viewDate);

  const [showForm, setShowForm] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState('');
  const [doseTime, setDoseTime] = useState(() => currentQuarter());
  const { activeCaregivers, caregiver, selectCaregiver } = useCaregiverChoice();

  const [editingId, setEditingId] = useState<string | null>(null);
  const { caregivers } = useHousehold();
  const [editCaregiverId, setEditCaregiverId] = useState<string | null>(null);
  const [originalCaregiverId, setOriginalCaregiverId] = useState<string | null>(null);
  const editPeople = caregivers.filter(p => p.is_active || p.caregiver_id === originalCaregiverId);
  const [showNewMedicineDialog, setShowNewMedicineDialog] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedNote, setNewMedNote] = useState('');

  const resetForm = () => {
    setSelectedMedicine('');
    setDoseTime(currentQuarter());
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!selectedMedicine || (!editingId && !caregiver)) return;
    if (editingId) {
      await updateMedicineLog(editingId, { medicine_id: selectedMedicine, ...doseTimeFields(doseTime), caregiver_id: changedCaregiverId(editCaregiverId, originalCaregiverId) });
    } else {
      await addMedicineLog({ medicine_id: selectedMedicine, ...doseTimeFields(doseTime), recorded_by: caregiver.display_name, caregiver_id: caregiver.caregiver_id });
    }
    resetForm();
  };

  const handleEdit = (log: MedicineLog) => {
    setSelectedMedicine(log.medicine_id);
    setDoseTime(doseTimeValue(log));
    setEditingId(log.id);
    setEditCaregiverId(log.caregiver_id ?? null);
    setOriginalCaregiverId(log.caregiver_id ?? null);
    setShowForm(true);
  };

  const handleAddNewMedicine = async () => {
    await addNewMedicine(newMedName, newMedNote);
    setNewMedName('');
    setNewMedNote('');
    setShowNewMedicineDialog(false);
  };

  const handleCopyPrevious = () => {
    const prevDate = format(subDays(parseISO(viewDate), 1), 'yyyy-MM-dd');
    copyFromPreviousDay(prevDate);
  };

  const getMedicineName = (medicineId: string) => {
    const med = medicines.find(m => m.id === medicineId);
    return med ? med.name : 'Unknown';
  };

  const getMedicineNote = (medicineId: string) => {
    const med = medicines.find(m => m.id === medicineId);
    return med?.schedule_note || '';
  };

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="px-4 pb-2 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Pill className="h-4 w-4" /> Medicines
          </CardTitle>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={handleCopyPrevious} className="gap-1 text-xs">
              <Copy className="h-3.5 w-3.5" /> Copy Prev
            </Button>
            <Button variant="outline" size="sm" onClick={() => { resetForm(); setShowForm(true); }} className="gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Logged medicines for this date */}
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No medicines logged for this day.</p>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words">{getMedicineName(log.medicine_id)}</p>
                  <p className="text-xs text-muted-foreground">
                    {doseTimeLabel(doseTimeValue(log))}
                    {getMedicineNote(log.medicine_id) && ` · ${getMedicineNote(log.medicine_id)}`}
                    {log.recorded_by && ` · by ${log.recorded_by}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(log)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <ConfirmDeleteButton variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete this dose log?" description={`${getMedicineName(log.medicine_id)} · ${doseTimeLabel(doseTimeValue(log))}. This permanently removes it from the record.`} onConfirm={() => deleteMedicineLog(log.id)}>
                    <Trash2 className="h-3 w-3" />
                  </ConfirmDeleteButton>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div className="space-y-3 rounded-lg border p-3 bg-background">
            <div>
              <Label className="text-xs text-muted-foreground">Medicine</Label>
              <Select value={selectedMedicine} onValueChange={v => {
                if (v === '__new__') {
                  setShowNewMedicineDialog(true);
                } else {
                  setSelectedMedicine(v);
                }
              }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select medicine" />
                </SelectTrigger>
                <SelectContent>
                  {medicines.map(med => (
                    <SelectItem key={med.id} value={med.id}>
                      {med.name} {med.schedule_note && `(${med.schedule_note})`}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__" className="text-primary font-medium">
                    + Add New Medicine
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Time</Label>
              <DoseTimePicker value={doseTime} onChange={setDoseTime} />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Recorded By</Label>
              <CaregiverPicker people={editingId ? editPeople : activeCaregivers} value={editingId ? editCaregiverId ?? undefined : caregiver?.caregiver_id} onChange={editingId ? setEditCaregiverId : selectCaregiver} />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} className="flex-1 gap-1" size="sm" disabled={!selectedMedicine || (!editingId && !caregiver)}>
                <Plus className="h-3.5 w-3.5" />
                {editingId ? 'Update' : 'Log Medicine'}
              </Button>
              <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Add New Medicine Dialog */}
      <Dialog open={showNewMedicineDialog} onOpenChange={setShowNewMedicineDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New Medicine</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Medicine Name</Label>
              <Input value={newMedName} onChange={e => setNewMedName(e.target.value)} placeholder="e.g. Ibuprofen 200mg" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Schedule Note</Label>
              <Input value={newMedNote} onChange={e => setNewMedNote(e.target.value)} placeholder="e.g. As needed" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddNewMedicine} disabled={!newMedName.trim()}>Add Medicine</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
