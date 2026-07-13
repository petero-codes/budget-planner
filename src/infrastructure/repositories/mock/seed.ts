import type {
  CostCenter,
  Department,
  FiscalYear,
  GlAccount,
  Position,
  User,
} from "@/domain/entities";

export const IDS = {
  deptIct: "dept-ict",
  fy2027: "fy-2027",
  posGm: "pos-gm",
  posMgrNet: "pos-mgr-net",
  posMgrSys: "pos-mgr-sys",
  posMgrRel: "pos-mgr-rel",
  posAsst: "pos-asst",
  joyce: "user-joyce",
  geofrey: "user-geofrey",
  georgina: "user-georgina",
  peter: "user-peter",
  edwin: "user-edwin",
  esther: "user-esther",
  western: "user-western",
  peterNdegwa: "user-peter-ndegwa",
  mary: "user-mary",
  eric: "user-eric",
  george: "user-george",
  patrick: "user-patrick",
  ruth: "user-ruth",
  chris: "user-chris",
  admin: "user-admin",
  posAdmin: "pos-admin",
  ccGm: "cc-kgn70090",
  ccNet: "cc-kgn70110",
  ccSys: "cc-kgn70120",
  ccRel: "cc-kgn70010",
  ccSysAdmin: "cc-kgn70020",
  ccNetAdmin: "cc-kgn70050",
  ccWestern: "cc-kgn700xx-wr",
  ccEnt: "cc-kgn70040",
  ccInd: "cc-kgn70070",
  ccWeb: "cc-kgn70100",
  ccSupport: "cc-kgn70060",
  ccRelMgmt: "cc-kgn70030",
  ccProjects: "cc-kgn70130",
  ccInfoSec: "cc-kgn70080",
} as const;

const submitApprove = [
  "budget.create",
  "budget.submit",
  "budget.approve",
  "budget.reject",
  "report.view",
] as const;

/** Root GM: operational + department audit (not SystemAdmin). */
const gmPerms = [...submitApprove, "audit.view"] as const;

const submitOnly = ["budget.create", "budget.submit"] as const;

const adminOnly = ["admin.users", "audit.view", "report.view"] as const;

export const departments: Department[] = [
  { id: IDS.deptIct, name: "ICT", code: "ICT" },
];

export const positions: Position[] = [
  { id: IDS.posGm, title: "General Manager, ICT", positionCode: "GM-ICT", level: 1 },
  {
    id: IDS.posMgrNet,
    title: "Manager, Networks & Infrastructure",
    positionCode: "MGR-NET",
    level: 2,
  },
  {
    id: IDS.posMgrSys,
    title: "Manager, Systems & Applications",
    positionCode: "MGR-SYS",
    level: 2,
  },
  {
    id: IDS.posMgrRel,
    title: "Manager, Relationship & Technical Support",
    positionCode: "MGR-REL",
    level: 2,
  },
  {
    id: IDS.posAsst,
    title: "Assistant Manager",
    positionCode: "ASST",
    level: 3,
  },
  {
    id: IDS.posAdmin,
    title: "System Administrator",
    positionCode: "SYSADMIN",
    level: 0,
  },
];

export const costCenters: CostCenter[] = [
  {
    id: IDS.ccGm,
    code: "KGN70090",
    sapCostCenterCode: "606509",
    name: "General Manager, ICT",
    departmentId: IDS.deptIct,
    isActive: true,
  },
  {
    id: IDS.ccNet,
    code: "KGN70110",
    sapCostCenterCode: "606511",
    name: "Network and Infrastructure",
    departmentId: IDS.deptIct,
    isActive: true,
  },
  {
    id: IDS.ccSys,
    code: "KGN70120",
    sapCostCenterCode: "606512",
    name: "Business Application",
    departmentId: IDS.deptIct,
    isActive: true,
  },
  {
    id: IDS.ccRel,
    code: "KGN70010",
    sapCostCenterCode: "606501",
    name: "Relationship Management and Technical Support",
    departmentId: IDS.deptIct,
    isActive: true,
  },
  {
    id: IDS.ccSysAdmin,
    code: "KGN70020",
    sapCostCenterCode: "606502",
    name: "System Architecture and Admin",
    departmentId: IDS.deptIct,
    isActive: true,
  },
  {
    id: IDS.ccNetAdmin,
    code: "KGN70050",
    sapCostCenterCode: "606505",
    name: "Networks & Telcomms",
    departmentId: IDS.deptIct,
    isActive: true,
  },
  {
    id: IDS.ccWestern,
    code: "KGN70025",
    sapCostCenterCode: "606514",
    name: "Western Region",
    departmentId: IDS.deptIct,
    isActive: true,
  },
  {
    id: IDS.ccEnt,
    code: "KGN70040",
    sapCostCenterCode: "606504",
    name: "Enterprise Apps",
    departmentId: IDS.deptIct,
    isActive: true,
  },
  {
    id: IDS.ccInd,
    code: "KGN70070",
    sapCostCenterCode: "606507",
    name: "Industrial Systems",
    departmentId: IDS.deptIct,
    isActive: true,
  },
  {
    id: IDS.ccWeb,
    code: "KGN70100",
    sapCostCenterCode: "606510",
    name: "Systems Integration & Web Technologies",
    departmentId: IDS.deptIct,
    isActive: true,
  },
  {
    id: IDS.ccSupport,
    code: "KGN70060",
    sapCostCenterCode: "606506",
    name: "Support Services",
    departmentId: IDS.deptIct,
    isActive: true,
  },
  {
    id: IDS.ccRelMgmt,
    code: "KGN70030",
    sapCostCenterCode: "606503",
    name: "Relationship Mgmt",
    departmentId: IDS.deptIct,
    isActive: true,
  },
  {
    id: IDS.ccProjects,
    code: "KGN70130",
    sapCostCenterCode: "606513",
    name: "Project Delivery & Reporting",
    departmentId: IDS.deptIct,
    isActive: true,
  },
  {
    id: IDS.ccInfoSec,
    code: "KGN70080",
    sapCostCenterCode: "606508",
    name: "Information Security",
    departmentId: IDS.deptIct,
    isActive: true,
  },
];

function user(
  id: string,
  name: string,
  email: string,
  positionId: string,
  managerId: string | null,
  primaryCostCenterId: string,
  permissions: readonly string[],
  roles: string[]
): User {
  return {
    id,
    name,
    email,
    positionId,
    managerId,
    departmentId: IDS.deptIct,
    primaryCostCenterId,
    active: true,
    roleCodes: roles,
    permissionCodes: [...permissions],
  };
}

export const users: User[] = [
  user(
    IDS.joyce,
    "Joyce Mwaniki",
    "joyce.mwaniki@kengen.co.ke",
    IDS.posGm,
    null,
    IDS.ccGm,
    [...gmPerms],
    ["BudgetSubmitter", "BudgetApprover"]
  ),
  user(
    IDS.geofrey,
    "Geofrey Kimutai",
    "geofrey.kimutai@kengen.co.ke",
    IDS.posMgrNet,
    IDS.joyce,
    IDS.ccNet,
    [...submitApprove],
    ["BudgetSubmitter", "BudgetApprover"]
  ),
  user(
    IDS.georgina,
    "Georgina Mukami",
    "georgina.mukami@kengen.co.ke",
    IDS.posMgrSys,
    IDS.joyce,
    IDS.ccSys,
    [...submitApprove],
    ["BudgetSubmitter", "BudgetApprover"]
  ),
  user(
    IDS.peter,
    "Peter Kamau",
    "peter.kamau@kengen.co.ke",
    IDS.posMgrRel,
    IDS.joyce,
    IDS.ccRel,
    [...submitApprove],
    ["BudgetSubmitter", "BudgetApprover"]
  ),
  user(
    IDS.edwin,
    "Edwin Omondi",
    "edwin.omondi@kengen.co.ke",
    IDS.posAsst,
    IDS.geofrey,
    IDS.ccSysAdmin,
    [...submitOnly],
    ["BudgetSubmitter"]
  ),
  user(
    IDS.esther,
    "Esther Wafula",
    "esther.wafula@kengen.co.ke",
    IDS.posAsst,
    IDS.geofrey,
    IDS.ccNetAdmin,
    [...submitOnly],
    ["BudgetSubmitter"]
  ),
  user(
    IDS.western,
    "Western Region Holder",
    "western.region@kengen.co.ke",
    IDS.posAsst,
    IDS.geofrey,
    IDS.ccWestern,
    [...submitOnly],
    ["BudgetSubmitter"]
  ),
  user(
    IDS.peterNdegwa,
    "Peter Ndegwa",
    "peter.ndegwa@kengen.co.ke",
    IDS.posAsst,
    IDS.georgina,
    IDS.ccEnt,
    [...submitOnly],
    ["BudgetSubmitter"]
  ),
  user(
    IDS.mary,
    "Mary Njogu",
    "mary.njogu@kengen.co.ke",
    IDS.posAsst,
    IDS.georgina,
    IDS.ccInd,
    [...submitOnly],
    ["BudgetSubmitter"]
  ),
  user(
    IDS.eric,
    "Eric Kiptoo",
    "eric.kiptoo@kengen.co.ke",
    IDS.posAsst,
    IDS.georgina,
    IDS.ccWeb,
    [...submitOnly],
    ["BudgetSubmitter"]
  ),
  user(
    IDS.george,
    "George Mwazia",
    "george.mwazia@kengen.co.ke",
    IDS.posAsst,
    IDS.peter,
    IDS.ccSupport,
    [...submitOnly],
    ["BudgetSubmitter"]
  ),
  user(
    IDS.patrick,
    "Patrick Njoroge",
    "patrick.njoroge@kengen.co.ke",
    IDS.posAsst,
    IDS.peter,
    IDS.ccRelMgmt,
    [...submitOnly],
    ["BudgetSubmitter"]
  ),
  user(
    IDS.ruth,
    "Ruth Nafula",
    "ruth.nafula@kengen.co.ke",
    IDS.posAsst,
    IDS.peter,
    IDS.ccProjects,
    [...submitOnly],
    ["BudgetSubmitter"]
  ),
  user(
    IDS.chris,
    "Chris Apuri",
    "chris.apuri@kengen.co.ke",
    IDS.posAsst,
    IDS.joyce,
    IDS.ccInfoSec,
    [...submitOnly],
    ["BudgetSubmitter"]
  ),
  user(
    IDS.admin,
    "ICT System Admin",
    "ict.admin@kengen.co.ke",
    IDS.posAdmin,
    null,
    IDS.ccGm,
    [...adminOnly],
    ["SystemAdmin"]
  ),
];

export const fiscalYears: FiscalYear[] = [
  {
    id: IDS.fy2027,
    yearLabel: 2027,
    startDate: "2026-07-01",
    endDate: "2027-06-30",
    isLocked: false,
  },
];

export const glAccounts: GlAccount[] = [
  { id: "gl-860206", code: "860206", description: "SOFTWARE LICENCES", isActive: true },
  { id: "gl-860601", code: "860601", description: "SAP MAINTENANCE EXPENSES", isActive: true },
  { id: "gl-860802", code: "860802", description: "TELEPHONES", isActive: true },
  { id: "gl-820406", code: "820406", description: "TRAINING", isActive: true },
  { id: "gl-820407", code: "820407", description: "TEAM BUILDING", isActive: true },
  { id: "gl-810601", code: "810601", description: "OFFICE EQUIPMENT, FURNITURE & CONSUMABLES", isActive: true },
  { id: "gl-810602", code: "810602", description: "STATIONARY", isActive: true },
  { id: "gl-860408", code: "860408", description: "CONSULTANTS FEES", isActive: true },
  { id: "gl-860108", code: "860108", description: "AIR TRAVEL EXPENSES", isActive: true },
  { id: "gl-820101", code: "820101", description: "ANNUAL SALARIES", isActive: true },
];
