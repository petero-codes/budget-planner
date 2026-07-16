import { NextRequest, NextResponse } from "next/server";
import {
  sapFormToCsv,
  sapFormToExcelHtml,
} from "@/application/sap-compliance-service";
import { getCurrentUser, sapComplianceService } from "@/infrastructure/di";
import { readApiError } from "@/lib/security/read-api-error";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const format = req.nextUrl.searchParams.get("format") ?? "json";

    if (format === "json") {
      const form = await sapComplianceService.getForm(user, params.id);
      return NextResponse.json({ data: form, correlationId });
    }

    if (format !== "csv" && format !== "excel" && format !== "pdf") {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "format must be json, csv, excel, or pdf",
            correlationId,
          },
        },
        { status: 422 }
      );
    }

    const form = await sapComplianceService.getFormForDownload(
      user,
      params.id,
      format,
      correlationId
    );
    const filename = `sap-compliance-${form.sapReference}`;

    if (format === "csv") {
      return new NextResponse(sapFormToCsv(form), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
          "X-Correlation-Id": correlationId,
        },
      });
    }
    if (format === "excel") {
      return new NextResponse(sapFormToExcelHtml(form), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.ms-excel",
          "Content-Disposition": `attachment; filename="${filename}.xls"`,
          "X-Correlation-Id": correlationId,
        },
      });
    }
    // pdf → audited server-side; client opens print dialog on the form page
    return NextResponse.json({ data: { ok: true }, correlationId });
  } catch (e) {
    return readApiError(e, correlationId);
  }
}
