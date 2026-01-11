import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { WeatherService, WeatherData } from '../../services/weather';
import { WeatherCardComponent } from '../weather-card/weather-card';
import { catchError, finalize, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { of, Subject } from 'rxjs';

@Component({
  selector: 'app-weather-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, WeatherCardComponent],
  templateUrl: './weather-dashboard.html',
  styleUrl: './weather-dashboard.scss',
})
export class WeatherDashboardComponent {
  // Hierarchical Search Fields
  selectedCountry: string = 'India';
  stateName: string = '';
  villageName: string = ''; // This acts as the main search term now

  // Weather State
  weatherData: WeatherData | null = null;
  loading: boolean = false;
  error: string | null = null;

  // Map State
  mapUrl: SafeResourceUrl | null = null;

  // Autocomplete State
  searchResults: any[] = [];
  showDropdown: boolean = false;
  private searchSubject = new Subject<string>();

  // State Autocomplete State
  stateSearchResults: any[] = [];
  showStateDropdown: boolean = false;
  private stateSearchSubject = new Subject<string>();

  // Static list of countries for demo
  countries: string[] = [
    'India', 'USA', 'UK', 'Australia', 'Canada', 'Germany', 'France', 'Japan', 'China', 'Brazil'
  ];

  constructor(
    private weatherService: WeatherService,
    private sanitizer: DomSanitizer
  ) {
    this.setupSearch();
    this.setupStateSearch();
  }

  private setupSearch() {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        // Search by name only to get broader results, then filter
        return this.weatherService.searchCities(query).pipe(
          map(results => this.filterResults(results))
        );
      })
    ).subscribe(results => {
      this.searchResults = results;
      this.showDropdown = results.length > 0;
    });
  }

  private setupStateSearch() {
    this.stateSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        // For state, we might still want to try appending country if API supports it, 
        // but safest is search name and filter.
        return this.weatherService.searchCities(query).pipe(
          map(results => {
            // Filter for results that match the selected country if set
            if (this.selectedCountry) {
              return results.filter(r => r.country === this.selectedCountry);
            }
            return results;
          })
        );
      })
    ).subscribe(results => {
      this.stateSearchResults = results;
      this.showStateDropdown = results.length > 0;
    });
  }

  private filterResults(results: any[]): any[] {
    if (!results) return [];

    return results.filter(item => {
      let match = true;

      // Filter by Country
      if (this.selectedCountry) {
        match = match && item.country === this.selectedCountry;
      }

      // Filter by State (fuzzy match on admin1)
      if (this.stateName && item.admin1) {
        // Simple case-insensitive inclusion check
        const stateQuery = this.stateName.toLowerCase();
        const itemState = item.admin1.toLowerCase();
        // matches if admin1 includes query or vice versa
        match = match && (itemState.includes(stateQuery) || stateQuery.includes(itemState));
      }

      return match;
    });
  }

  // Defense in Depth: Sanitize input to prevent injection-like patterns
  // Strictly allow only alphanumeric, spaces, commas, hyphens, and dots.
  private sanitizeInput(input: string): string {
    return input.replace(/[^a-zA-Z0-9\s,.-]/g, '');
  }

  // Construct query not strictly needed for API anymore but good for fallback
  private constructQuery(village: string): string {
    return this.sanitizeInput(village);
  }

  onStateInput(event: Event) {
    const raw = (event.target as HTMLInputElement).value;
    const query = this.sanitizeInput(raw);
    this.stateName = query;
    if (query.length >= 2) {
      this.stateSearchSubject.next(query);
    } else {
      this.stateSearchResults = [];
      this.showStateDropdown = false;
    }
  }

  selectState(result: any) {
    // If Admin1 is present, use that, else name if it looks like a region
    // Result typically has: name, admin1, country
    // If I search "Karnataka", result name is "Karnataka", admin1 might be same or null
    this.stateName = result.name;
    // Auto-select country if present
    if (result.country) {
      this.selectedCountry = result.country;
    }

    this.showStateDropdown = false;
    this.stateSearchResults = [];
  }

  onSearchInput(event: Event) {
    const raw = (event.target as HTMLInputElement).value;
    const village = this.sanitizeInput(raw);
    this.villageName = village;

    if (village.length >= 2) {
      this.searchSubject.next(village);
    } else {
      this.searchResults = [];
      this.showDropdown = false;
    }
  }

  selectCity(city: any) {
    // Determine display name
    const parts = [city.name];
    if (city.admin1) parts.push(city.admin1); // Admin1 often maps to State/Region
    if (city.country) parts.push(city.country);

    this.villageName = city.name; // Keep just the name in the box or full? Let's keep name.

    // Updates UI to show selected context
    if (city.country) this.selectedCountry = city.country;
    if (city.admin1) this.stateName = city.admin1;

    this.showDropdown = false;
    this.getWeatherForLocation(city.latitude, city.longitude, city.name);
  }

  searchWeather() {
    if (!this.villageName.trim()) return;
    this.showDropdown = false;

    // If manual search, try to use the full constructed query
    const fullQuery = this.constructQuery(this.villageName);
    const sanitized = this.sanitizeInput(fullQuery);
    this.getWeatherByName(sanitized);
  }

  private getWeatherForLocation(lat: number, lon: number, name: string) {
    this.loading = true;
    this.error = null;
    this.weatherData = null;
    this.mapUrl = null; // Reset map while loading

    this.weatherService.getWeatherByCoordinates(lat, lon).pipe(
      map(data => ({ ...data, city: name })), // Add city name to result
      catchError((err) => {
        this.error = 'Could not fetch weather. Please try again.';
        return of(null);
      }),
      finalize(() => {
        this.loading = false;
      })
    ).subscribe((data) => {
      this.weatherData = data;
      if (data) {
        this.updateMapUrl(lat, lon);
      }
    });
  }

  // Keep this for manual text entry
  private getWeatherByName(name: string) {
    this.loading = true;
    this.error = null;
    this.weatherData = null;
    this.mapUrl = null;

    this.weatherService.getWeather(name).pipe(
      catchError((err) => {
        this.error = 'Could not fetch weather. Please try another location.';
        return of(null);
      }),
      finalize(() => {
        this.loading = false;
      })
    ).subscribe((data) => {
      this.weatherData = data;
      if (data && data.lat && data.lon) {
        this.updateMapUrl(data.lat, data.lon);
      }
    });
  }

  private updateMapUrl(lat: number, lon: number) {
    const url = `https://maps.google.com/maps?q=${lat},${lon}&t=&z=13&ie=UTF8&iwloc=&output=embed`;
    this.mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
