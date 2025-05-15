import { TestBed } from '@angular/core/testing';

import { PdfReportService } from './pdf-report.service';

describe('PdfReportService', () => {
  let service: PdfReportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PdfReportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
