import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';

export interface WeatherData {
  temperature: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
  time: string;
  city?: string;
  lat?: number;
  lon?: number;
}

@Injectable({
  providedIn: 'root',
})
export class WeatherService {
  private readonly GEO_API_URL = 'https://geocoding-api.open-meteo.com/v1/search';
  private readonly WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';

  constructor(private http: HttpClient) { }

  getWeather(cityName: string): Observable<WeatherData> {
    return this.getCoordinates(cityName).pipe(
      switchMap(coords => {
        if (!coords) {
          return throwError(() => new Error('City not found'));
        }
        return this.getWeatherByCoordinates(coords.lat, coords.lon).pipe(
          map(data => ({
            ...data,
            city: coords.name
          }))
        );
      })
    );
  }

  // ... searchCities and getCoordinates remain same ...

  searchCities(query: string): Observable<any[]> {
    if (!query || query.length < 2) return of([]);

    return this.http.get<any>(this.GEO_API_URL, {
      params: {
        name: query,
        count: 5,
        language: 'en',
        format: 'json'
      }
    }).pipe(
      map(response => response.results || []),
      catchError(() => of([]))
    );
  }

  private getCoordinates(cityName: string): Observable<{ lat: number, lon: number, name: string } | null> {
    return this.http.get<any>(this.GEO_API_URL, {
      params: {
        name: cityName,
        count: 1,
        language: 'en',
        format: 'json'
      }
    }).pipe(
      map(response => {
        if (response.results && response.results.length > 0) {
          const result = response.results[0];
          return { lat: result.latitude, lon: result.longitude, name: result.name };
        }
        return null;
      }),
      catchError(() => of(null))
    );
  }

  getWeatherByCoordinates(lat: number, lon: number): Observable<WeatherData> {
    return this.http.get<any>(this.WEATHER_API_URL, {
      params: {
        latitude: lat,
        longitude: lon,
        current: 'temperature_2m,is_day,weather_code,wind_speed_10m',
        timezone: 'auto'
      }
    }).pipe(
      map(response => {
        const current = response.current;
        return {
          temperature: current.temperature_2m,
          isDay: current.is_day === 1,
          weatherCode: current.weather_code,
          windSpeed: current.wind_speed_10m,
          time: current.time,
          lat: lat,
          lon: lon
        };
      })
    );
  }
}
