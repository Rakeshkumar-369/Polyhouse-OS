// English / Telugu. t('English text') returns Telugu when the user picked Telugu, else the English text.
// To translate a new string: add "English": "తెలుగు" to TE below. Missing keys fall back to English.
import { useEffect, useState } from 'react';

const TE = {
  // navigation
  Home: 'హోమ్', Sell: 'అమ్మకం', Harvest: 'కోత', Spend: 'ఖర్చు', Reports: 'రిపోర్టులు', Vendors: 'వెండర్లు', Labour: 'కూలీలు', Alerts: 'హెచ్చరికలు',
  More: 'మరిన్ని', Settings: 'సెట్టింగ్‌లు', 'Settings & users': 'సెట్టింగ్‌లు & యూజర్లు', 'My account': 'నా ఖాతా', Logout: 'లాగౌట్',
  'Farm setup': 'ఫారం సెటప్', Grow: 'పెంపకం', 'Spend & stock': 'ఖర్చు & స్టాక్', Work: 'పని', 'Money & records': 'డబ్బు & రికార్డులు', Admin: 'అడ్మిన్', Main: 'ముఖ్యమైనవి',
  'Farms / polyhouses': 'ఫారాలు / పాలీహౌస్‌లు', 'Bays / plots': 'బేలు / ప్లాట్లు', Crops: 'పంటలు', 'Crop cycles': 'పంట కాలాలు',
  'Daily tasks': 'రోజువారీ పనులు', 'EC / pH log': 'EC / pH నమోదు', 'Fertigation recipes': 'ఎరువుల మిశ్రమాలు', 'Climate log': 'వాతావరణ నమోదు', Scouting: 'పురుగుల పరిశీలన', 'Spray log': 'పిచికారీ నమోదు',
  'All sales': 'అన్ని అమ్మకాలు', 'Vendor orders': 'వెండర్ ఆర్డర్లు', 'Vendor price list': 'వెండర్ ధరల జాబితా', 'Payments received': 'వచ్చిన చెల్లింపులు', 'All harvests': 'అన్ని కోతలు', 'Vendors & suppliers': 'వెండర్లు & సరఫరాదారులు',
  'All expenses': 'అన్ని ఖర్చులు', 'Recurring payments': 'నెలవారీ చెల్లింపులు', 'Input stock': 'సామగ్రి స్టాక్', 'Stock in / out': 'స్టాక్ లోపలికి / బయటికి', 'Expense categories': 'ఖర్చు రకాలు',
  'Workers & salaries': 'కూలీలు & జీతాలు', 'Attendance records': 'హాజరు రికార్డులు', 'Advances & bonus': 'అడ్వాన్సులు & బోనస్', 'Wage payments': 'జీతాల చెల్లింపులు',
  'Other income': 'ఇతర ఆదాయం', Loans: 'అప్పులు', 'Loan repayments': 'అప్పు చెల్లింపులు', 'Assets & maintenance': 'ఆస్తులు & నిర్వహణ', 'Document vault': 'పత్రాలు',

  // common
  Save: 'సేవ్', 'Save changes': 'మార్పులు సేవ్', Add: 'జోడించు', Cancel: 'రద్దు', Delete: 'తొలగించు', Edit: 'మార్చు', Search: 'వెతుకు', Total: 'మొత్తం', Today: 'ఈరోజు', Yesterday: 'నిన్న',
  'This week': 'ఈ వారం', 'Last week': 'గత వారం', 'This month': 'ఈ నెల', 'Last month': 'గత నెల', 'Last 30 days': 'గత 30 రోజులు', 'Last 90 days': 'గత 90 రోజులు',
  'This financial year': 'ఈ ఆర్థిక సంవత్సరం', 'This calendar year': 'ఈ సంవత్సరం', 'Custom dates': 'తేదీలు ఎంచుకోండి', 'by day': 'రోజువారీ', 'by week': 'వారంవారీ', 'by month': 'నెలవారీ',
  Date: 'తేదీ', Amount: 'మొత్తం', Quantity: 'పరిమాణం', Rate: 'ధర', Grade: 'గ్రేడ్', Crop: 'పంట', Vendor: 'వెండర్', Farm: 'ఫారం', Bay: 'బే', Worker: 'కూలీ', Notes: 'గమనికలు', Note: 'గమనిక',
  Status: 'స్థితి', Name: 'పేరు', Phone: 'ఫోన్', Category: 'రకం', Description: 'వివరణ', Yes: 'అవును', No: 'కాదు', 'All farms': 'అన్ని ఫారాలు', 'Loading…': 'లోడ్ అవుతోంది…',
  'Nothing here yet': 'ఇంకా ఏమీ లేదు', 'No entries yet': 'ఇంకా నమోదులు లేవు', Saved: 'సేవ్ అయింది', Updated: 'మార్చబడింది', Deleted: 'తొలగించబడింది', Language: 'భాష', Close: 'మూసివేయి',
  Next: 'తర్వాత', Back: 'వెనుకకు', Skip: 'దాటవేయి', Done: 'పూర్తి', Filters: 'ఫిల్టర్లు', 'Add first': 'మొదటిది జోడించండి', entries: 'నమోదులు',
  present: 'హాజరు', half: 'సగం రోజు', absent: 'గైర్హాజరు', leave: 'సెలవు', todo: 'చేయాలి', done: 'పూర్తి', open: 'తెరిచి ఉంది', delivered: 'అందజేశారు', accepted: 'అంగీకరించారు', disputed: 'వివాదం',

  // login
  'Welcome back': 'స్వాగతం', 'Login with your phone number or user ID': 'మీ ఫోన్ నంబర్ లేదా యూజర్ ID తో లాగిన్ అవ్వండి', 'Phone / User ID': 'ఫోన్ / యూజర్ ID', Password: 'పాస్‌వర్డ్', Login: 'లాగిన్',
  'Logging in…': 'లాగిన్ అవుతోంది…', 'Try a demo account': 'డెమో ఖాతాతో ప్రయత్నించండి',

  // dashboard
  Dashboard: 'డాష్‌బోర్డ్', Sales: 'అమ్మకాలు', Expenses: 'ఖర్చులు', Profit: 'లాభం', Loss: 'నష్టం', Harvested: 'కోసినది', Collected: 'వసూలైనది', Overdue: 'బాకీ మీరినది',
  'vs prev.': 'గతంతో', 'Needs attention': 'గమనించాల్సినవి', 'Sales vs expenses': 'అమ్మకాలు vs ఖర్చులు', 'Cost vs price per unit, by crop': 'పంట వారీగా ఖర్చు vs ధర', 'Quantity sold by crop': 'పంట వారీగా అమ్మిన పరిమాణం',
  'Plucked today': 'ఈరోజు కోసినది', 'Labour today': 'ఈరోజు కూలీలు', "Today's tasks": 'ఈరోజు పనులు', 'Open vendor orders': 'పెండింగ్ ఆర్డర్లు', 'Harvest locked (spray)': 'కోత నిషేధం (పిచికారీ)',
  'My farm today': 'ఈరోజు నా ఫారం', 'Cash in hand': 'చేతిలో నగదు', 'Days to collect': 'వసూలుకు రోజులు', 'Who owes how long': 'ఎవరు ఎంత కాలంగా బాకీ',
  'Crop cycles vs target': 'పంట కాలాలు vs లక్ష్యం', 'Best paying vendor per crop': 'పంటకు ఎక్కువ ధర ఇచ్చే వెండర్', 'Price trend': 'ధరల ధోరణి', 'Best selling days': 'ఎక్కువ అమ్మకాల రోజులు', 'Where the money went': 'డబ్బు ఎక్కడికి వెళ్ళింది',

  'Good morning': 'శుభోదయం', 'Good afternoon': 'శుభ మధ్యాహ్నం', 'Good evening': 'శుభ సాయంత్రం', 'In one line': 'ఒక్క మాటలో', 'Finish setting up': 'సెటప్ పూర్తి చేయండి',
  'Add your farm / polyhouse': 'మీ ఫారం / పాలీహౌస్ జోడించండి', 'Add crops you grow': 'మీ పంటలు జోడించండి', 'Add vendors you sell to': 'వెండర్లను జోడించండి',
  "Set each vendor's price": 'ప్రతి వెండర్ ధర పెట్టండి', 'Add workers with pay': 'కూలీలు & జీతం జోడించండి', 'Create logins for your team': 'మీ టీమ్‌కు లాగిన్లు ఇవ్వండి',
  'Avg price': 'సగటు ధర', 'margin': 'మార్జిన్', 'sold': 'అమ్మినది', 'rejected': 'తిరస్కరణ', 'collected': 'వసూలు', 'Profit / acre': 'ఎకరాకు లాభం', 'Man-days': 'పని దినాలు', 'Labour cost': 'కూలీ ఖర్చు',

  // sell / harvest / spend
  'Sell / deliver': 'అమ్మకం / డెలివరీ', '1. Crop': '1. పంట', '2. Vendor': '2. వెండర్', '3. Quantity': '3. పరిమాణం', 'Save sale': 'అమ్మకం సేవ్', 'Open orders': 'పెండింగ్ ఆర్డర్లు',
  'Sales today': 'ఈరోజు అమ్మకాలు', 'Produce stock (3 days)': 'సరుకు స్టాక్ (3 రోజులు)', 'Available to sell': 'అమ్మకానికి ఉంది', 'Against order': 'ఆర్డర్ ప్రకారం', None: 'ఏదీ కాదు',
  'More details': 'మరిన్ని వివరాలు', 'Invoice / slip no.': 'బిల్లు / స్లిప్ నం.', 'From farm': 'ఏ ఫారం నుండి', 'Rate / unit': 'ధర / యూనిట్',
  'Save harvest': 'కోత సేవ్', 'Culls / waste': 'పాడైనవి', 'Picked by': 'కోసినవారు', 'Do not pick:': 'కోయవద్దు:', 'Record what was plucked — by crop and grade': 'పంట, గ్రేడ్ వారీగా కోసినది నమోదు చేయండి',
  'What did you pay for?': 'దేనికి చెల్లించారు?', 'Paid by': 'ఎలా చెల్లించారు', 'Paid to / supplier': 'ఎవరికి / సరఫరాదారు', 'Save expense': 'ఖర్చు సేవ్', 'Bill photo': 'బిల్లు ఫోటో', 'Bill no.': 'బిల్లు నం.',
  'Recent expenses': 'ఇటీవలి ఖర్చులు', 'Stock item (optional)': 'స్టాక్ వస్తువు (ఐచ్ఛికం)', Qty: 'పరిమాణం', 'Farm (blank = shared)': 'ఫారం (ఖాళీ = అన్నింటికీ)',

  // labour
  Attendance: 'హాజరు', 'Wage run': 'జీతాల లెక్క', Workers: 'కూలీలు', 'Advances / bonus': 'అడ్వాన్సు / బోనస్', 'Save attendance': 'హాజరు సేవ్', 'Mark rest present': 'మిగతావారు హాజరు',
  'Work done': 'చేసిన పని', 'OT hrs': 'ఓవర్‌టైమ్', Pay: 'చెల్లించు', Days: 'రోజులు', Gross: 'మొత్తం జీతం', Net: 'చేతికి', Paid: 'చెల్లించారు', 'Advance cut': 'అడ్వాన్సు కోత',
  'Check in': 'హాజరు వేయండి', 'Check out': 'బయటికి వెళ్తున్నాను', 'Done for today': 'ఈరోజు పూర్తి', 'My work today': 'ఈరోజు నా పని', 'Mark done': 'పూర్తయింది',
  'My attendance': 'నా హాజరు', Payslips: 'జీతం స్లిప్పులు', 'Do not enter / pick:': 'లోపలికి వెళ్ళవద్దు / కోయవద్దు:', 'Advance to be adjusted': 'కోత వేయాల్సిన అడ్వాన్సు', 'No payments yet': 'ఇంకా చెల్లింపులు లేవు',

  // vendor portal
  'You owe': 'మీ బాకీ', Deliveries: 'డెలివరీలు', Statement: 'లెక్కల పట్టిక', Prices: 'ధరలు', 'My orders': 'నా ఆర్డర్లు', Confirm: 'నిర్ధారించు', 'Confirm delivery': 'డెలివరీ నిర్ధారించండి',
  'Rejected quantity (0 if all good)': 'తిరస్కరించిన పరిమాణం (అంతా బాగుంటే 0)', Remark: 'వ్యాఖ్య', 'Place an order': 'ఆర్డర్ ఇవ్వండి', 'Send order': 'ఆర్డర్ పంపండి', 'Needed on': 'ఎప్పుడు కావాలి', 'Your prices today': 'ఈరోజు మీ ధరలు',

  // setup wizard
  'Set up your farm': 'మీ ఫారం సెటప్ చేయండి', 'Farm details': 'ఫారం వివరాలు', 'Crops you grow': 'మీరు పండించే పంటలు', 'Vendors & prices': 'వెండర్లు & ధరలు', 'Workers & pay': 'కూలీలు & జీతం',
  'Start using Polyhouse OS': 'పాలీహౌస్ OS ప్రారంభించండి', 'Skip setup for now': 'ఇప్పుడు సెటప్ దాటవేయి',

  // field labels from the server
  Type: 'రకం', 'Member / land owner (FPO)': 'సభ్యుడు / భూ యజమాని', 'Location / village': 'ప్రాంతం / గ్రామం', District: 'జిల్లా', 'Area (acres)': 'విస్తీర్ణం (ఎకరాలు)',
  'Length (m)': 'పొడవు (మీ)', 'Width (m)': 'వెడల్పు (మీ)', 'Height (m)': 'ఎత్తు (మీ)', Ownership: 'యాజమాన్యం', 'Monthly rent': 'నెల అద్దె', 'Lease ends on': 'లీజు ముగింపు', Active: 'యాక్టివ్',
  'Bay / plot name': 'బే / ప్లాట్ పేరు', 'Area (sq m)': 'విస్తీర్ణం (చ.మీ)', Variety: 'రకం', Unit: 'యూనిట్', 'Default price / unit': 'సాధారణ ధర / యూనిట్', 'Vendor name': 'వెండర్ పేరు', 'Vendor type': 'వెండర్ రకం',
  'Credit days': 'అప్పు రోజులు', 'Contact person': 'సంప్రదింపు వ్యక్తి', Address: 'చిరునామా', 'Price / unit': 'ధర / యూనిట్', 'Effective from': 'ఎప్పటి నుండి', 'Quantity plucked': 'కోసిన పరిమాణం',
  'Crop cycle': 'పంట కాలం', 'Rejected qty': 'తిరస్కరించినది', 'What for': 'దేనికి', 'Paid now (blank = fully paid)': 'ఇప్పుడు చెల్లించినది (ఖాళీ = పూర్తిగా)', 'Supplier / paid to': 'సరఫరాదారు',
  'Role / skill': 'పని / నైపుణ్యం', 'Works at': 'పని చేసే చోటు', 'Daily wage': 'రోజు కూలీ', 'Monthly salary': 'నెల జీతం', 'Piece rate per kg harvested': 'కిలోకు కూలీ', 'Joined on': 'చేరిన తేదీ',
  'Check in time': 'లోపలికి వచ్చిన సమయం', Task: 'పని', 'Assigned to': 'ఎవరికి', 'Feed EC': 'ఫీడ్ EC', 'Feed pH': 'ఫీడ్ pH', 'Drain EC': 'డ్రెయిన్ EC', 'Drain pH': 'డ్రెయిన్ pH', 'Water used (L)': 'వాడిన నీరు (లీ)',
  'Temperature (°C)': 'ఉష్ణోగ్రత (°C)', 'Humidity (%)': 'తేమ (%)', 'Pest / disease': 'పురుగు / వ్యాధి', 'Sticky trap count': 'జిగురు అట్ట లెక్క', Severity: 'తీవ్రత', 'Sprayed on': 'పిచికారీ తేదీ',
  Product: 'మందు', Dose: 'మోతాదు', 'Target pest': 'లక్ష్య పురుగు', 'Pre-harvest interval (days)': 'కోతకు ముందు విరామం (రోజులు)', 'Harvest safe from': 'కోత సురక్షితం', 'Sprayed by': 'పిచికారీ చేసినవారు',
  Item: 'వస్తువు', Movement: 'కదలిక', 'Used at farm': 'వాడిన ఫారం', 'In stock now': 'ప్రస్తుత స్టాక్', 'Alert when stock below': 'స్టాక్ తగ్గితే హెచ్చరిక', 'Opening stock': 'ప్రారంభ స్టాక్',
  Mode: 'విధానం', 'Reference / UTR': 'రిఫరెన్స్ / UTR', Source: 'మూలం', 'Paid on': 'చెల్లించిన తేదీ', 'Needed on ': 'ఎప్పుడు కావాలి',
};

const DICTS = { te: TE };
let lang = localStorage.getItem('pos_lang') || 'en';
const subs = new Set();

export const getLang = () => lang;
export function setLang(l) { lang = l; localStorage.setItem('pos_lang', l); document.documentElement.lang = l; subs.forEach((f) => f(l)); }
export const t = (s) => (lang !== 'en' && s && DICTS[lang]?.[s]) || s;

// Re-render the component tree when the language changes
export function useLang() {
  const [l, set] = useState(lang);
  useEffect(() => { subs.add(set); return () => subs.delete(set); }, []);
  return l;
}
