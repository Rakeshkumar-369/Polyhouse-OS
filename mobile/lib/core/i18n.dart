// English / Telugu. tr('English text') returns Telugu when the user picked Telugu.
// To translate more: add 'English': 'తెలుగు' below (same keys as client/src/lib/i18n.js).
class I18n {
  static String lang = 'en';
}

String tr(String s) => I18n.lang == 'te' ? (_te[s] ?? s) : s;

const Map<String, String> _te = {
  'Home': 'హోమ్', 'Sell': 'అమ్మకం', 'Harvest': 'కోత', 'Spend': 'ఖర్చు', 'Reports': 'రిపోర్టులు', 'Vendors': 'వెండర్లు', 'Labour': 'కూలీలు',
  'Alerts': 'హెచ్చరికలు', 'More': 'మరిన్ని', 'Settings': 'సెట్టింగ్‌లు', 'Logout': 'లాగౌట్', 'Language': 'భాష', 'Smart suggestions': 'స్మార్ట్ సూచనలు',
  'Save': 'సేవ్', 'Add': 'జోడించు', 'Cancel': 'రద్దు', 'Delete': 'తొలగించు', 'Edit': 'మార్చు', 'Search': 'వెతుకు', 'Total': 'మొత్తం', 'Today': 'ఈరోజు',
  'This week': 'ఈ వారం', 'This month': 'ఈ నెల', 'Last month': 'గత నెల', 'Last 30 days': 'గత 30 రోజులు', 'Last 90 days': 'గత 90 రోజులు', 'This financial year': 'ఈ ఆర్థిక సంవత్సరం',
  'Date': 'తేదీ', 'Amount': 'మొత్తం', 'Quantity': 'పరిమాణం', 'Rate': 'ధర', 'Grade': 'గ్రేడ్', 'Crop': 'పంట', 'Vendor': 'వెండర్', 'Farm': 'ఫారం', 'Bay': 'బే',
  'Worker': 'కూలీ', 'Notes': 'గమనికలు', 'Note': 'గమనిక', 'Status': 'స్థితి', 'Name': 'పేరు', 'Phone': 'ఫోన్', 'Category': 'రకం', 'Description': 'వివరణ',
  'Welcome back': 'స్వాగతం', 'Login with your phone number or user ID': 'మీ ఫోన్ నంబర్ లేదా యూజర్ ID తో లాగిన్ అవ్వండి', 'Phone / User ID': 'ఫోన్ / యూజర్ ID',
  'Password': 'పాస్‌వర్డ్', 'Login': 'లాగిన్', 'Server address': 'సర్వర్ చిరునామా',
  'Sales': 'అమ్మకాలు', 'Expenses': 'ఖర్చులు', 'Profit': 'లాభం', 'Loss': 'నష్టం', 'Harvested': 'కోసినది', 'Collected': 'వసూలైనది', 'Overdue': 'బాకీ మీరినది',
  'Needs attention': 'గమనించాల్సినవి', 'Sales vs expenses': 'అమ్మకాలు vs ఖర్చులు', 'Plucked today': 'ఈరోజు కోసినది', 'Labour today': 'ఈరోజు కూలీలు',
  'Good morning': 'శుభోదయం', 'Good afternoon': 'శుభ మధ్యాహ్నం', 'Good evening': 'శుభ సాయంత్రం', 'In one line': 'ఒక్క మాటలో', 'Cash in hand': 'చేతిలో నగదు',
  'Crops': 'పంటలు', 'Who owes how long': 'ఎవరు ఎంత కాలంగా బాకీ', 'Best paying vendor per crop': 'పంటకు ఎక్కువ ధర ఇచ్చే వెండర్',
  'Sell / deliver': 'అమ్మకం / డెలివరీ', '1. Crop': '1. పంట', '2. Vendor': '2. వెండర్', '3. Quantity': '3. పరిమాణం', 'Save sale': 'అమ్మకం సేవ్',
  'Sales today': 'ఈరోజు అమ్మకాలు', 'Save harvest': 'కోత సేవ్', 'Culls / waste': 'పాడైనవి', 'Picked by': 'కోసినవారు', 'Do not pick:': 'కోయవద్దు:',
  'What did you pay for?': 'దేనికి చెల్లించారు?', 'Paid by': 'ఎలా చెల్లించారు', 'Save expense': 'ఖర్చు సేవ్', 'Recent expenses': 'ఇటీవలి ఖర్చులు',
  'Attendance': 'హాజరు', 'Save attendance': 'హాజరు సేవ్', 'Mark rest present': 'మిగతావారు హాజరు', 'Wage run': 'జీతాల లెక్క', 'Pay': 'చెల్లించు', 'Paid': 'చెల్లించారు',
  'Check in': 'హాజరు వేయండి', 'Check out': 'బయటికి వెళ్తున్నాను', 'Done for today': 'ఈరోజు పూర్తి', 'My work today': 'ఈరోజు నా పని', 'Mark done': 'పూర్తయింది',
  'My attendance': 'నా హాజరు', 'Payslips': 'జీతం స్లిప్పులు', 'Do not enter / pick:': 'లోపలికి వెళ్ళవద్దు / కోయవద్దు:', 'Days': 'రోజులు',
  'You owe': 'మీ బాకీ', 'Deliveries': 'డెలివరీలు', 'Statement': 'లెక్కల పట్టిక', 'Prices': 'ధరలు', 'My orders': 'నా ఆర్డర్లు', 'Confirm': 'నిర్ధారించు',
  'Place an order': 'ఆర్డర్ ఇవ్వండి', 'Quick entry': 'త్వరిత నమోదు', 'Sale': 'అమ్మకం', 'Expense': 'ఖర్చు', 'Payment received': 'వచ్చిన చెల్లింపు',
  'Temperature': 'ఉష్ణోగ్రత', 'Spray': 'పిచికారీ', 'Task': 'పని', 'Records': 'రికార్డులు', 'All records': 'అన్ని రికార్డులు', 'Next month': 'వచ్చే నెల',
  'Best season': 'మంచి కాలం', 'Price': 'ధర', 'Weak month': 'బలహీన నెల', 'Season calendar': 'సీజన్ క్యాలెండర్', 'Nothing here yet': 'ఇంకా ఏమీ లేదు',
  'Saved': 'సేవ్ అయింది', 'Retry': 'మళ్ళీ ప్రయత్నించండి', 'Modules on/off': 'మాడ్యూల్స్ ఆన్/ఆఫ్', 'Users & logins': 'యూజర్లు & లాగిన్లు',
  'Farm setup': 'ఫారం సెటప్', 'Grow': 'పెంపకం', 'Spend & stock': 'ఖర్చు & స్టాక్', 'Work': 'పని', 'Money & records': 'డబ్బు & రికార్డులు',
};
