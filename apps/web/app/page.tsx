'use client';

import {
  BadgeIndianRupee,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleGauge,
  Download,
  FileText,
  IndianRupee,
  Layers3,
  LogIn,
  Plus,
  Printer,
  ReceiptText,
  Search,
  ShieldCheck,
  Smartphone,
  WalletCards,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

type Role = 'super' | 'admin' | 'member';
type PaymentMode = 'Cash' | 'UPI' | 'Cheque' | 'Bank Transfer';

interface Mandal {
  id: string;
  name: string;
  locality: string;
  city: string;
  admin: string;
  members: number;
  status: 'Active' | 'Setup';
}

interface Slip {
  id: string;
  number: string;
  contributorName: string;
  shopName: string;
  area: string;
  amount: number;
  paymentMode: PaymentMode;
  collectedBy: string;
  group: string;
  createdAt: string;
  mobile: string;
  notes: string;
}

interface Expense {
  id: string;
  category: string;
  vendor: string;
  amount: number;
  status: 'Approved' | 'Submitted';
}

const initialMandals: Mandal[] = [
  {
    id: 'M-1001',
    name: 'Pune Ganpati Utsav Demo Mandal',
    locality: 'Budhwar Peth',
    city: 'Pune',
    admin: 'Amit Kulkarni',
    members: 186,
    status: 'Active',
  },
  {
    id: 'M-1002',
    name: 'Shivneri Dahi Handi Mandal',
    locality: 'Kothrud',
    city: 'Pune',
    admin: 'Rahul Shinde',
    members: 74,
    status: 'Setup',
  },
];

const initialSlips: Slip[] = [
  {
    id: 'S-1',
    number: 'DM-GNP-2026-000431',
    contributorName: 'Mahesh Traders',
    shopName: 'Mahesh Traders',
    area: 'Laxmi Road',
    amount: 5100,
    paymentMode: 'UPI',
    collectedBy: 'Sagar Jadhav',
    group: 'Market Area',
    createdAt: '26 Jul 2026, 10:42 AM',
    mobile: '9876543210',
    notes: 'Annual sponsor',
  },
  {
    id: 'S-2',
    number: 'DM-GNP-2026-000432',
    contributorName: 'Joshi Family',
    shopName: '',
    area: 'Budhwar Peth Lane 3',
    amount: 1101,
    paymentMode: 'Cash',
    collectedBy: 'Neha Pawar',
    group: 'Society Area',
    createdAt: '26 Jul 2026, 11:05 AM',
    mobile: '9822211122',
    notes: 'Home collection',
  },
  {
    id: 'S-3',
    number: 'DM-GNP-2026-000433',
    contributorName: 'Omkar Electricals',
    shopName: 'Omkar Electricals',
    area: 'Appa Balwant Chowk',
    amount: 2501,
    paymentMode: 'Cash',
    collectedBy: 'Sagar Jadhav',
    group: 'Market Area',
    createdAt: '26 Jul 2026, 11:19 AM',
    mobile: '9888888888',
    notes: 'Lighting vendor contact',
  },
];

const initialExpenses: Expense[] = [
  {
    id: 'E-1',
    category: 'Decoration',
    vendor: 'Shree Decorators',
    amount: 42000,
    status: 'Approved',
  },
  { id: 'E-2', category: 'Sound', vendor: 'Sai Audio', amount: 18000, status: 'Approved' },
  { id: 'E-3', category: 'Permissions', vendor: 'PMC Desk', amount: 7500, status: 'Submitted' },
];

const groups = ['Market Area', 'Society Area', 'Temple Road', 'Station Road'];
const members = ['Sagar Jadhav', 'Neha Pawar', 'Amit Kulkarni', 'Prachi More'];

export default function Home() {
  const [role, setRole] = useState<Role>('super');
  const [mandals, setMandals] = useState<Mandal[]>(initialMandals);
  const [slips, setSlips] = useState<Slip[]>(initialSlips);
  const [expenses] = useState<Expense[]>(initialExpenses);
  const [selectedSlip, setSelectedSlip] = useState<Slip>(initialSlips[0]);
  const [mandalName, setMandalName] = useState('');
  const [areaSearch, setAreaSearch] = useState('');

  const totalCollection = slips.reduce((sum, slip) => sum + slip.amount, 0);
  const approvedExpenses = expenses
    .filter((expense) => expense.status === 'Approved')
    .reduce((sum, expense) => sum + expense.amount, 0);
  const cashTotal = slips
    .filter((slip) => slip.paymentMode === 'Cash')
    .reduce((sum, slip) => sum + slip.amount, 0);

  const memberTotals = useMemo(() => {
    return members.map((member) => ({
      member,
      total: slips
        .filter((slip) => slip.collectedBy === member)
        .reduce((sum, slip) => sum + slip.amount, 0),
    }));
  }, [slips]);

  function createMandal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = mandalName.trim();

    if (!name) {
      return;
    }

    setMandals((current) => [
      {
        id: `M-${1000 + current.length + 1}`,
        name,
        locality: 'Pune',
        city: 'Pune',
        admin: 'New Mandal Admin',
        members: 0,
        status: 'Setup',
      },
      ...current,
    ]);
    setMandalName('');
  }

  function generateSlip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('amount') || 0);

    if (amount <= 0) {
      return;
    }

    const nextNumber = `DM-GNP-2026-${String(434 + slips.length).padStart(6, '0')}`;
    const slip: Slip = {
      id: crypto.randomUUID(),
      number: nextNumber,
      contributorName: String(form.get('contributorName') || ''),
      shopName: String(form.get('shopName') || ''),
      area: String(form.get('area') || ''),
      amount,
      paymentMode: String(form.get('paymentMode') || 'Cash') as PaymentMode,
      collectedBy: String(form.get('collectedBy') || members[0]),
      group: String(form.get('group') || groups[0]),
      createdAt: new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date()),
      mobile: String(form.get('mobile') || ''),
      notes: String(form.get('notes') || ''),
    };

    setSlips((current) => [slip, ...current]);
    setSelectedSlip(slip);
    event.currentTarget.reset();
  }

  const filteredSlips = slips.filter((slip) =>
    [slip.area, slip.contributorName, slip.shopName, slip.collectedBy]
      .join(' ')
      .toLowerCase()
      .includes(areaSearch.toLowerCase()),
  );

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">DM</div>
          <div>
            <strong>Digital Mandal</strong>
            <span>Festival OS</span>
          </div>
        </div>
        <nav className="role-switcher" aria-label="Demo role">
          <button className={role === 'super' ? 'active' : ''} onClick={() => setRole('super')}>
            <ShieldCheck size={18} /> Super Admin
          </button>
          <button className={role === 'admin' ? 'active' : ''} onClick={() => setRole('admin')}>
            <CircleGauge size={18} /> Mandal Admin
          </button>
          <button className={role === 'member' ? 'active' : ''} onClick={() => setRole('member')}>
            <Smartphone size={18} /> Member App
          </button>
        </nav>
        <div className="pitch-card">
          <BadgeIndianRupee size={22} />
          <strong>Digital Vargani</strong>
          <span>Live collection, receipt, expense and accountability engine.</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p>Ganpati 2026 Demo</p>
            <h1>{roleTitle(role)}</h1>
          </div>
          <div className="top-actions">
            <button type="button" onClick={() => window.print()}>
              <Printer size={18} /> Print Receipt
            </button>
            <button type="button">
              <Download size={18} /> Export
            </button>
          </div>
        </header>

        <section className="metrics-grid">
          <Metric
            icon={<IndianRupee />}
            label="Total Vargani"
            value={money(totalCollection)}
            note="Live festival collection"
          />
          <Metric
            icon={<ReceiptText />}
            label="Slips Generated"
            value={String(slips.length)}
            note="Unique numbered receipts"
          />
          <Metric
            icon={<Banknote />}
            label="Cash To Reconcile"
            value={money(cashTotal)}
            note="Khajindar handover view"
          />
          <Metric
            icon={<WalletCards />}
            label="Balance"
            value={money(totalCollection - approvedExpenses)}
            note="After approved expenses"
          />
        </section>

        {role === 'super' && (
          <section className="two-column">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <p>Onboarding</p>
                  <h2>Create Mandal Account</h2>
                </div>
                <Plus size={20} />
              </div>
              <form className="form-grid" onSubmit={createMandal}>
                <label>
                  Mandal name
                  <input
                    value={mandalName}
                    onChange={(event) => setMandalName(event.target.value)}
                    placeholder="Enter mandal name"
                  />
                </label>
                <label>
                  Locality
                  <input defaultValue="Pune" />
                </label>
                <label>
                  Admin mobile
                  <input defaultValue="+919876543210" />
                </label>
                <button className="primary" type="submit">
                  <Plus size={18} /> Create Mandal
                </button>
              </form>
            </div>
            <div className="panel table-panel">
              <div className="panel-heading">
                <div>
                  <p>10,000 Mandal Ready</p>
                  <h2>Mandals</h2>
                </div>
                <Layers3 size={20} />
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Mandal</th>
                    <th>Admin</th>
                    <th>Members</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mandals.map((mandal) => (
                    <tr key={mandal.id}>
                      <td>
                        <strong>{mandal.name}</strong>
                        <span>
                          {mandal.locality}, {mandal.city}
                        </span>
                      </td>
                      <td>{mandal.admin}</td>
                      <td>{mandal.members}</td>
                      <td>
                        <span className={`status ${mandal.status.toLowerCase()}`}>
                          {mandal.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {role === 'admin' && (
          <section className="dashboard-grid">
            <div className="panel wide">
              <div className="panel-heading">
                <div>
                  <p>Collection Command Center</p>
                  <h2>Member-wise Vargani</h2>
                </div>
                <SearchBox value={areaSearch} onChange={setAreaSearch} />
              </div>
              <div className="bar-list">
                {memberTotals.map((row) => (
                  <div className="bar-row" key={row.member}>
                    <span>{row.member}</span>
                    <div>
                      <i
                        style={{
                          width: `${Math.max(8, (row.total / Math.max(totalCollection, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <strong>{money(row.total)}</strong>
                  </div>
                ))}
              </div>
              <div className="slip-list">
                {filteredSlips.map((slip) => (
                  <button key={slip.id} onClick={() => setSelectedSlip(slip)}>
                    <span>{slip.number}</span>
                    <strong>{slip.contributorName}</strong>
                    <em>
                      {money(slip.amount)} · {slip.paymentMode} · {slip.collectedBy}
                    </em>
                  </button>
                ))}
              </div>
            </div>
            <ReceiptPreview slip={selectedSlip} />
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <p>Expenses</p>
                  <h2>Festival Spend</h2>
                </div>
                <FileText size={20} />
              </div>
              <div className="expense-list">
                {expenses.map((expense) => (
                  <div key={expense.id}>
                    <span>{expense.category}</span>
                    <strong>{money(expense.amount)}</strong>
                    <em>
                      {expense.vendor} · {expense.status}
                    </em>
                  </div>
                ))}
              </div>
            </div>
            <TemplatePanel />
          </section>
        )}

        {role === 'member' && (
          <section className="two-column member-view">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <p>Member Login: Sagar Jadhav</p>
                  <h2>Generate Vargani Slip</h2>
                </div>
                <LogIn size={20} />
              </div>
              <form className="form-grid" onSubmit={generateSlip}>
                <label>
                  Contributor name
                  <input name="contributorName" required placeholder="Name of donor / shop owner" />
                </label>
                <label>
                  Shop / company
                  <input name="shopName" placeholder="Optional" />
                </label>
                <label>
                  Mobile
                  <input name="mobile" inputMode="tel" placeholder="10 digit mobile" />
                </label>
                <label>
                  Area
                  <input name="area" required defaultValue="Laxmi Road" />
                </label>
                <label>
                  Amount
                  <input name="amount" required inputMode="numeric" placeholder="1101" />
                </label>
                <label>
                  Payment mode
                  <select name="paymentMode">
                    <option>Cash</option>
                    <option>UPI</option>
                    <option>Cheque</option>
                    <option>Bank Transfer</option>
                  </select>
                </label>
                <label>
                  Collected by
                  <select name="collectedBy">
                    {members.map((member) => (
                      <option key={member}>{member}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Group
                  <select name="group">
                    {groups.map((group) => (
                      <option key={group}>{group}</option>
                    ))}
                  </select>
                </label>
                <label className="full">
                  Custom note
                  <input name="notes" placeholder="Sponsor category, reference, building name..." />
                </label>
                <button className="primary full" type="submit">
                  <ReceiptText size={18} /> Generate Digital Slip
                </button>
              </form>
            </div>
            <ReceiptPreview slip={selectedSlip} />
          </section>
        )}
      </section>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="metric">
      <span>{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
      <em>{note}</em>
    </article>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="search">
      <Search size={16} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search area, member, donor"
      />
    </label>
  );
}

function ReceiptPreview({ slip }: { slip: Slip }) {
  return (
    <div className="receipt-panel">
      <div className="receipt">
        <div className="receipt-top">
          <span>श्री</span>
          <div>
            <h2>Pune Ganpati Utsav Demo Mandal</h2>
            <p>Digital Vargani Receipt · Ganpati Festival 2026</p>
          </div>
        </div>
        <div className="receipt-number">{slip.number}</div>
        <dl>
          <div>
            <dt>Name</dt>
            <dd>{slip.contributorName}</dd>
          </div>
          <div>
            <dt>Shop</dt>
            <dd>{slip.shopName || '-'}</dd>
          </div>
          <div>
            <dt>Area</dt>
            <dd>{slip.area}</dd>
          </div>
          <div>
            <dt>Mobile</dt>
            <dd>{slip.mobile || '-'}</dd>
          </div>
          <div>
            <dt>Payment</dt>
            <dd>{slip.paymentMode}</dd>
          </div>
          <div>
            <dt>Collected By</dt>
            <dd>{slip.collectedBy}</dd>
          </div>
        </dl>
        <div className="receipt-amount">
          <span>Amount Received</span>
          <strong>{money(slip.amount)}</strong>
        </div>
        <p className="receipt-note">{slip.notes || 'Thank you for supporting the festival.'}</p>
        <div className="receipt-footer">
          <span>{slip.createdAt}</span>
          <CheckCircle2 size={18} /> Verified Digital Slip
        </div>
      </div>
    </div>
  );
}

function TemplatePanel() {
  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <p>Template Engine</p>
          <h2>Slip Fields</h2>
        </div>
        <CalendarDays size={20} />
      </div>
      <div className="field-map">
        {[
          'Slip No',
          'Date',
          'Name',
          'Shop',
          'Amount',
          'Payment Mode',
          'Collected By',
          'Custom Fields',
        ].map((field) => (
          <span key={field}>{field}</span>
        ))}
      </div>
      <p className="muted">
        Upload each mandal's printed vargani slip design, place fields, preview, and activate a
        version.
      </p>
    </div>
  );
}

function roleTitle(role: Role) {
  if (role === 'super') return 'Super Admin: Mandal Onboarding';
  if (role === 'admin') return 'Mandal Admin: Collection Dashboard';
  return 'Member: Mobile Vargani Generator';
}

function money(value: number) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}
