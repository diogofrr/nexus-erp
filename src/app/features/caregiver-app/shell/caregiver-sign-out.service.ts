import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CaregiverSessionService } from '../../../core/auth/caregiver-session.service';
import { DialogService } from '../../../shared/ui/overlay/dialog.service';
import { ContactDialogService } from '../state/contact-dialog.service';

/**
 * Sair do aplicativo: fecha o que estiver aberto, encerra a sessão do cuidador e leva à entrada. Usado pelo menu
 * do usuário e pela tela Mais. O cuidador não gera linha no log de auditoria ao sair.
 */
@Injectable({ providedIn: 'root' })
export class CaregiverSignOutService {
  private readonly session = inject(CaregiverSessionService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly contact = inject(ContactDialogService);

  async signOut(): Promise<void> {
    this.dialogs.cancelAll();
    this.contact.close();
    this.session.signOut();
    await this.router.navigateByUrl('/login');
  }
}
