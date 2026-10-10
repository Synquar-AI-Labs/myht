import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

type Props = Omit<React.ComponentProps<typeof Button>, 'onClick'> & {
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
};

export function ConfirmDeleteButton({ onConfirm, children, disabled, title = 'Delete this entry?', description = 'This permanently removes it from the record.', ...props }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button {...props} disabled={disabled} onClick={e => { e.stopPropagation(); setOpen(true); }}>{children}</Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction disabled={disabled} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { void onConfirm(); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
