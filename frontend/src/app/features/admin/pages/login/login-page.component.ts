import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminStore } from '../../services/admin.store';
import { ViewEncapsulation } from '@angular/core';
@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-page.component.html',
  styleUrl: '../../styles/admin.scss',
  encapsulation: ViewEncapsulation.None,
})
export class LoginPageComponent {
  readonly vm = inject(AdminStore);
  constructor() {
    this.vm.adminKeyError = this.vm.session.error;
  }
}
