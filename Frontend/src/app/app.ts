import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GlobalLoaderComponent } from './shared/ui/global-loader.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, GlobalLoaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
}
