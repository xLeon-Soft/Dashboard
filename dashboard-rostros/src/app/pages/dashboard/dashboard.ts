import { Component, OnInit, OnDestroy, computed, signal, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { interval, Subscription } from 'rxjs';
import { DashboardService } from '../../services/dashboard';
import { DashboardResponse, ResumenPorDia } from '../../models/dashboard';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit, OnDestroy {
  cargando = signal(true);
  error = signal('');
  data = signal<DashboardResponse | null>(null);
  ultimaActualizacion = signal('');
  pageSize = signal(3);
  currentPage = signal(1);
  tablePageSize = signal(12);
  currentTablePage = signal(1);
  generandoPDF = signal(false);
  fechaReporte = signal('');
  registrosReporte = signal<any[]>([]);

  statsReporte = computed(() => {
    const records = this.registrosReporte();
    let hombres = 0;
    let mujeres = 0;
    let total = 0;
    for (const r of records) {
        const generos = (r.Genero || '').split(',');
        for (const g of generos) {
            const gl = g.trim().toLowerCase();
            if (gl === 'hombre') hombres++;
            else if (gl === 'mujer') mujeres++;
        }
        total += parseInt(r.RostrosDetectados) || 0;
    }
    const totalRegistrados = hombres + mujeres;
    const pctHombres = totalRegistrados ? (hombres / totalRegistrados) * 100 : 0;
    const pctMujeres = totalRegistrados ? (mujeres / totalRegistrados) * 100 : 0;
    return { hombres, mujeres, total, pctHombres, pctMujeres };
  });

  hayRegistrosEnFecha = computed(() => {
    const selected = this.fechaReporte();
    if (!selected) return true;

    const items = this.data()?.por_dia ?? [];
    const targetParts = selected.split('-');
    const reversed = `${targetParts[2]}/${targetParts[1]}/${targetParts[0]}`;

    return items.some(item => item.fecha === selected || item.fecha === reversed);
  });

  // Drag-to-scroll members
  private isDragging = false;
  private startX = 0;
  private initialScrollLeft = 0;

  startDragging(event: MouseEvent, container: HTMLDivElement): void {
    this.isDragging = true;
    this.startX = event.pageX - container.offsetLeft;
    this.initialScrollLeft = container.scrollLeft;
    container.style.scrollBehavior = 'auto'; // Disable smooth scroll while dragging
  }

  stopDragging(container: HTMLDivElement): void {
    this.isDragging = false;
    container.style.scrollBehavior = 'smooth';
  }

  moveChart(event: MouseEvent, container: HTMLDivElement): void {
    if (!this.isDragging) return;
    event.preventDefault();
    const x = event.pageX - container.offsetLeft;
    const walk = (x - this.startX) * 1.5; // Drag speed
    container.scrollLeft = this.initialScrollLeft - walk;
  }

  syncScroll(event: Event, target: HTMLDivElement): void {
    const source = event.target as HTMLDivElement;
    if (target.scrollLeft !== source.scrollLeft) {
      target.scrollLeft = source.scrollLeft;
    }
  }
  
  // Interactive States
  hoveredSlice = signal<string | null>(null);
  hoveredDay = signal<ResumenPorDia | null>(null);
  tooltipPos = signal<{ x: number, y: number }>({ x: 0, y: 0 });

  apiUrl = 'http://127.0.0.1:8000';
  videoUrl = 'http://127.0.0.1:8000/video_feed';
  Math = Math;

  private refreshSubscription?: Subscription;

  maxPersonas = computed(() => {
    const items: ResumenPorDia[] = this.data()?.por_dia ?? [];
    return Math.max(...items.map((i: ResumenPorDia) => i.personas), 1);
  });

  totalPages = computed(() => {
    const items: ResumenPorDia[] = this.data()?.por_dia ?? [];
    return Math.max(1, Math.ceil(items.length / this.pageSize()));
  });

  paginaPorDia = computed(() => {
    const items: ResumenPorDia[] = this.data()?.por_dia ?? [];
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return items.slice(start, start + size);
  });

  totalTablePages = computed(() => {
    const items: ResumenPorDia[] = this.data()?.por_dia ?? [];
    return Math.max(1, Math.ceil(items.length / this.tablePageSize()));
  });

  tablaPorDia = computed(() => {
    const items: ResumenPorDia[] = this.data()?.por_dia ?? [];
    const page = this.currentTablePage();
    const size = this.tablePageSize();
    const start = (page - 1) * size;
    return items.slice(start, start + size);
  });

  maxChartValue = computed(() => {
    const items = this.data()?.por_dia ?? [];
    if (items.length === 0) return 200;
    const max = Math.max(...items.map(i => Math.max(i.hombres, i.mujeres)), 10);
    // Fixed scale of 200 if data fits, otherwise scale up
    return Math.max(200, Math.ceil(max / 50) * 50); 
  });

  pathHombres = computed(() => {
    const items = this.data()?.por_dia ?? [];
    if (items.length === 0) return '';
    if (items.length === 1) return `M 50,220 L 950,220`;
    
    const maxVal = this.maxChartValue();
    const stepX = 900 / (items.length - 1);
    
    return items.map((item, i) => {
      const x = 50 + i * stepX;
      const y = 220 - (item.hombres / maxVal) * 180;
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');
  });

  areaHombres = computed(() => {
    const path = this.pathHombres();
    if (!path) return '';
    return `${path} L 1000,300 L 0,300 Z`;
  });

  pathMujeres = computed(() => {
    const items = this.data()?.por_dia ?? [];
    if (items.length === 0) return '';
    if (items.length === 1) return `M 50,220 L 950,220`;
    
    const maxVal = this.maxChartValue();
    const stepX = 900 / (items.length - 1);
    
    return items.map((item, i) => {
      const x = 50 + i * stepX;
      const y = 220 - (item.mujeres / maxVal) * 180;
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');
  });

  areaMujeres = computed(() => {
    const path = this.pathMujeres();
    if (!path) return '';
    return `${path} L 1000,300 L 0,300 Z`;
  });

  promedioDiario = computed(() => {
    const items = this.data()?.por_dia ?? [];
    if (items.length === 0) return 0;
    const total = items.reduce((acc, curr) => acc + curr.personas, 0);
    return Math.round(total / items.length);
  });

  detectadosHoy = computed(() => {
    const items = this.data()?.por_dia ?? [];
    if (items.length === 0) return 0;
    
    // Get the last item in por_dia (assuming it's chronological)
    const lastItem = items[items.length - 1];
    return lastItem.personas;
  });

  constructor(
    private dashboardService: DashboardService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.cargarDatos(true);
      this.iniciarActualizacionAutomatica();
    } else {
      this.cargando.set(false);
    }
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  iniciarActualizacionAutomatica(): void {
    this.refreshSubscription = interval(3000).subscribe(() => {
      this.cargarDatos(false);
    });
  }

  cargarDatos(mostrarLoader: boolean = false): void {
    if (mostrarLoader) {
      this.cargando.set(true);
    }

    this.error.set('');

    const isInitialLoad = this.data() === null;

    this.dashboardService.getEstadisticas().subscribe({
      next: (resp) => {
        this.data.set(resp);
        if (isInitialLoad) {
          this.currentPage.set(1);
          this.currentTablePage.set(1);
        }
        this.ultimaActualizacion.set(this.obtenerHoraActual());
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las estadísticas desde la API.');
        this.cargando.set(false);
      }
    });
  }

  obtenerHoraActual(): string {
    return new Date().toLocaleTimeString('es-GT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  porcentajeBarra(valor: number): number {
    const max = this.maxPersonas();
    return max > 0 ? (valor / max) * 100 : 0;
  }

  setPage(page: number): void {
    const total = this.totalPages();
    this.currentPage.set(Math.min(Math.max(1, page), total));
  }

  prevPage(): void {
    this.setPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.setPage(this.currentPage() + 1);
  }

  setTablePage(page: number): void {
    const total = this.totalTablePages();
    this.currentTablePage.set(Math.min(Math.max(1, page), total));
  }

  prevTablePage(): void {
    this.setTablePage(this.currentTablePage() - 1);
  }

  nextTablePage(): void {
    this.setTablePage(this.currentTablePage() + 1);
  }

  totalGenero(): number {
    const dashboard = this.data();
    if (!dashboard) return 0;

    return (dashboard.totales.hombres ?? 0) + (dashboard.totales.mujeres ?? 0);
  }

  porcentajeHombres(): number {
    const dashboard = this.data();
    if (!dashboard) return 0;

    const total = this.totalGenero();
    if (total === 0) return 0;

    return Math.round(((dashboard.totales.hombres ?? 0) / total) * 100);
  }

  porcentajeMujeres(): number {
    const dashboard = this.data();
    if (!dashboard) return 0;

    const total = this.totalGenero();
    if (total === 0) return 0;

    return Math.round(((dashboard.totales.mujeres ?? 0) / total) * 100);
  }

  promedioPorEvento(): string {
    const dashboard = this.data();
    if (!dashboard || dashboard.totales.eventos === 0) {
      return '0';
    }

    return (dashboard.totales.personas / dashboard.totales.eventos).toFixed(1);
  }

  obtenerNivelNormalizado(porcentaje: number): number {
    const valor = 1 - porcentaje / 100;
    return Math.max(0, Math.min(1, valor));
  }

  obtenerFechaRango(): string {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return `${monthStart.toLocaleDateString('es-ES')} - ${today.toLocaleDateString('es-ES')}`;
  }

  obtenerHoraSegundos(): string {
    return new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  obtenerHoraCompleta(): string {
    return new Date().toLocaleDateString('es-ES') + ' ' + this.obtenerHoraSegundos();
  }

  handlePieHover(slice: string | null, event?: MouseEvent): void {
    this.hoveredSlice.set(slice);
    if (event) {
      this.tooltipPos.set({ x: event.clientX, y: event.clientY });
    }
  }

  handleTrendHover(day: ResumenPorDia | null, event?: MouseEvent): void {
    this.hoveredDay.set(day);
    if (event) {
      this.tooltipPos.set({ x: event.clientX, y: event.clientY });
    }
  }

  updateTooltipPos(event: MouseEvent): void {
    this.tooltipPos.set({ x: event.clientX, y: event.clientY });
  }

  obtenerCoordenadaPie(porcentaje: number, radio: number = 50): { x: number, y: number } {
    const angulo = (porcentaje / 100) * 2 * Math.PI - (Math.PI / 2);
    return {
      x: Math.cos(angulo) * radio,
      y: Math.sin(angulo) * radio
    };
  }

  generarPathPie(inicioPct: number, finPct: number): string {
    const radio = 50;
    const inicio = this.obtenerCoordenadaPie(inicioPct, radio);
    const fin = this.obtenerCoordenadaPie(finPct, radio);
    const largeArcFlag = (finPct - inicioPct) > 50 ? 1 : 0;
    
    return `M 0,0 L ${inicio.x},${inicio.y} A ${radio},${radio} 0 ${largeArcFlag} 1 ${fin.x},${fin.y} Z`;
  }

  posicionLabelPie(inicioPct: number, finPct: number): { x: number, y: number } {
    const radioEtiqueta = 30; // Posicionar a 60% del radio (50 * 0.6 = 30)
    const porcentajeMedio = inicioPct + (finPct - inicioPct) / 2;
    const angulo = (porcentajeMedio / 100) * 2 * Math.PI - (Math.PI / 2);
    return {
      x: Math.cos(angulo) * radioEtiqueta,
      y: Math.sin(angulo) * radioEtiqueta
    };
  }

  trackByFecha(_: number, item: ResumenPorDia): string {
    return item.fecha;
  }

  exportarReportePDF(): void {
    if (this.fechaReporte()) {
      this.generandoPDF.set(true);
      this.dashboardService.getRegistros().subscribe({
          next: (res) => {
              const targetDate = this.fechaReporte();
              
              // El backend nos puede dar la fecha en formato YYYY-MM-DD o DD/MM/YYYY
              // Tratamos de normalizar targetDate que viene del input date en YYYY-MM-DD
              const targetParts = targetDate.split('-');
              const targetDateFormatted = targetDate;
              const targetDateReversed = `${targetParts[2]}/${targetParts[1]}/${targetParts[0]}`;

              const filtered = res.registros.filter(r => {
                  const rDate = r.FechaHora ? r.FechaHora.split(' ')[0] : '';
                  return rDate === targetDateFormatted || rDate === targetDateReversed;
              });
              this.registrosReporte.set(filtered);
              
              setTimeout(() => {
                  this.generarPDFElemento('.daily-report-container', `Reporte_Detecciones_${targetDate}.pdf`);
              }, 500);
          },
          error: () => {
            console.error('Error al obtener registros');
            this.generandoPDF.set(false);
          }
      });
    } else {
      this.generandoPDF.set(true);
      this.generarPDFElemento('.unified-panel', `Reporte_Dashboard_${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}.pdf`);
    }
  }

  generarPDFElemento(selector: string, filename: string): void {
    const element = document.querySelector(selector) as HTMLElement;
    if (!element) {
      this.generandoPDF.set(false);
      return;
    }

    html2canvas(element, { 
      scale: 2, 
      useCORS: true,
      backgroundColor: '#f2f5f1' 
    }).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      // First page
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      // Add new pages if content is taller than A4 page
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(filename);
      this.generandoPDF.set(false);
    }).catch(err => {
      console.error('Error generando PDF', err);
      this.generandoPDF.set(false);
    });
  }
}