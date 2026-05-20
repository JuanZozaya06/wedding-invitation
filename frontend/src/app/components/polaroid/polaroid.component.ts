import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-polaroid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './polaroid.component.html',
  styleUrl: './polaroid.component.scss',
})
export class PolaroidComponent {
  readonly imageUrl = input.required<string>();
  readonly alt = input<string>('Foto en estilo polaroid');
  readonly caption = input<string>('');
}
