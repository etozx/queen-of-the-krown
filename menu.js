'use strict';
// Her services, add-ons and policies (shared by the app and the public styles page).
// Her real menu, copied from her Acuity booking page (queenofthekrownbooking.as.me). [category, name, dollars, minutes, description]
const MENU = [
  ['Braids', 'Miracle Knot Braids *Burmese curl', 560, 300, 'Made on your natural hair, braided as the foundation, with crochet hair added throughout and to the ends for a full, seamless look. Smedium parts. Includes 18-inch 100% human hair bundles; for longer or fuller, pick the add-ons. Needs a $150 deposit (the rest of the deposit can be sent by Zelle).'],
  ['Braids', 'Miracle Knot Braids *Loose wave', 600, 300, 'Comes with 2 bundles (full head) of loose wave crochet hair, done with the braid-in method.'],
  ['Braids', 'Miracle Knots *Body wave', 570, 300, 'Comes with 2 bundles (full head) of body wave crochet hair, done with the braid-in method. Can last up to 2 months!'],
  ['Bobs', 'Intertwined Bob', 320, 360, ''],
  ['Bobs', 'Queens Bob 2.0', 300, 420, 'Comes with human hair curls added!'],
  ['Bobs', 'Flip Over Boho Bob', 370, 420, 'Includes human hair boho along with twist and Fulani!'],
  ['Bobs', 'Twisted Fulani Bob', 315, 420, ''],
  ['Bobs', 'Invisible Passion Bob', 240, 270, ''],
  ['Bobs', 'Invisible Locs', 285, 390, 'Comes with curls.'],
  ['Bobs', 'Bliss Twist', 295, 360, ''],
  ['For The Natural Girls', 'Fulani Curly Fro', 400, 240, 'Freestyle Fulani braids in the front, with 2 bundles of Burmese curly crochet hair in the back!'],
  ['For The Natural Girls', 'Queens Kinky Curly Twist', 400, 300, '100% human hair twists with boho pieces. Bra-strap length; add on length if you want it longer.'],
  ['For the Loc Girlys', 'Invisible Passion Twist (over locs)', 300, 420, 'Please text a photo of your locs before booking so the right hair can be bought.'],
  ['For the Loc Girlys', 'Miracle Knots over Locs *Burmese curl', 400, 300, 'Includes a retwist with 100% human hair boho added throughout (3–4 boho pieces per loc). Apply all add-ons. Hair must be washed before the appointment.'],
  ['Island Twist', 'Queen Twist *Mid back', 320, 420, ''],
  ['Island Twist', 'Latto Braids with a Twist', 300, 300, 'Hair included! Fulani braids in the front, island twist in the back, with curly ends. Butt length; text to request shorter.'],
  ['Island Twist', 'Island Twist', 400, 420, 'Smedium parts and curly ends. Add the length you want in the add-ons.'],
  ['Island Twist', 'Island Twist *Mid back', 350, 360, ''],
  ['Locs', 'Nubian Locs', 660, 390, 'Comes with 3 bundles of 100% human hair, with boho added throughout and to the ends. Add an extra bundle for a fuller look!'],
  ['Locs', 'Boho Loc Bob 2.0', 320, 390, 'Soft locs with 100% human hair boho, cut into a bob. 2–4 boho pieces on each loc!'],
  ['Locs', 'Lotus Locs', 355, 360, 'Lightweight locs with small parts.'],
  ['Locs', 'Indie Locs', 250, 360, ''],
  ['Locs', 'Queen Locs', 350, 430, 'Comes with 100% human hair curls and medium parts.'],
  ['Locs', 'Mermaid Locs', 420, 430, 'Waist/butt length.'],
  ['Men Styles', 'Twist (men)', 75, 180, 'Done on natural hair. Come with your hair washed.'],
  ['Men Styles', 'Freestyle Braids', 70, 210, 'Natural hair only.'],
  ["Men Styles", "The King's Choice", 135, 270, ''],
  ['New Styles', 'Creative Control Service', 200, 420, 'Price depends on the style you book.'],
  ['Passion Twist', 'Passion Twist', 250, 360, ''],
  ['Passion Twist', 'Curly Passion Twist', 280, 330, 'Rubber bands at the roots, usually waist/butt length.'],
  ['Passion Twist', 'Crisscross Passion Twist', 400, 390, 'Knotless passion twist in the back, rubber band crisscross in the front, with curly ends. Lasts 4–8 weeks.'],
  ['Passion Twist', 'Crisscross Passion Twist *Mid back', 285, 300, 'Comes with curls added and curly ends.'],
  ['Passion Twist', 'Invisible Passion Twist', 300, 360, ''],
  ['Removals', 'Miracle Knot Take Down', 200, 150, 'Full braid take down plus detangling with leave-in conditioner.'],
  ['Removals', 'Indie Loc Removal', 85, 240, 'Takes down your locs and plates, then detangles. Add on the loc style you got.'],
  ['Touch Ups', 'Loc Touch Up', 75, 90, 'Touch up of the whole front half with three loc replacements.'],
  ['Touch Ups', 'Island Twist *Touch up only', 190, 180, 'Take out only the perimeter of your twist, and wash and blow dry your hair first.'],
  ['Specialty Services', 'Small Passion Twist Butt Length', 500, 780, 'Butt-length passion twist with human hair curls in the front.'],
];
// Her add-ons from the same page: id: [name, dollars, extra minutes]. MENU_ADDONS[i] lists the add-ons offered with MENU[i].
const ADDONS = {
  5139311: ['#30 curls', 0, 0], 3654001: ['Color 1B', 0, 0], 6920276: ['20 inch', 93, 0], 6920278: ['22 inch', 100, 0],
  7243903: ['22 inch', 120, 0], 6366496: ['27,30 deep wave', 30, 0], 6366488: ['4,27,30 deep wave', 30, 0], 5309546: ['4,27,30 mix', 0, 0],
  5588693: ['ACV rinse', 10, 0], 3911899: ['Below waist length', 75, 0], 3633417: ['Blow dry', 20, 30], 6126724: ['Body wave', 0, 0],
  4946669: ['Boho soft locs', 20, 30], 4639906: ['Burgundy', 0, 0], 4027548: ['Burgundy', 10, 0], 5407049: ['Burgundy', 0, 0],
  4950468: ['Butt length', 0, 0], 4117119: ['Butt length', 70, 45], 3654003: ['Color 1', 0, 0], 3654005: ['Color 2', 0, 0],
  4571552: ['Color 27', 0, 0], 5075934: ['Color 27', 0, 0], 3823922: ['Color 27/30 mix', 20, 0], 3654011: ['Color 30', 0, 0],
  3823920: ['Color 30 highlights', 10, 0], 4307215: ['Color 350', 0, 0], 3654016: ['Color 350', 35, 0], 3654008: ['Color 4', 0, 0],
  3653894: ['Curls', 20, 10], 3875580: ['Curly ends', 10, 10], 6921622: ['Extra bundle', 100, 0], 6670032: ['Extra bundle', 100, 60],
  3875570: ['Extra curls', 20, 0], 3875575: ['Extra human curls', 65, 10], 3915180: ['Full color tuck', 50, 60], 3714049: ['Full head', 20, 30],
  3981235: ['Hair jewelry', 10, 0], 4058987: ['Highlights color 27', 12, 0], 4235090: ['Human hair curls', 65, 0], 4946672: ['Indie locs', 0, 0],
  3584605: ['Just top (sides faded)', 0, 0], 3913991: ['Locs over locs', 65, 0], 4421965: ['Marley hair', 0, 0], 3445538: ['Mid back length', 0, 0],
  6353157: ['Natural color 1B', 0, 0], 5139309: ['Ombré 30', 0, 0], 3654018: ['Ombré 27', 0, 0], 3654021: ['Ombré 30', 0, 0],
  3827275: ['Priority appointment', 50, 0], 5720137: ['Request color mix', 20, 0], 6353201: ['Smaller parts', 100, 60], 3911879: ['Smaller parts', 80, 60],
  6972011: ['Squeeze in', 50, 0], 3844483: ['Thick hair', 20, 45], 3653977: ['Thigh length', 90, 60], 5956803: ['Thigh length', 100, 60],
  4449973: ['Triangle parts', 10, 25], 5749758: ['Twist out', 0, 0], 4950470: ['Waist length', 0, 0], 5749759: ['Wash n go', 0, 0],
  4472033: ['Wash + blow dry', 55, 180],
};
const MENU_ADDONS = [
  [6920276,6920278,3633417,6921622,6353201,6972011,3844483],
  [7243903,6353201,3844483],
  [],
  [3654001,3633417,3654003,3654005,3654008,3875570,3981235,3654021,3827275,3844483],
  [3654001,3633417,3654003,3654005,4571552,3654011,3654008,3875575,3981235,3827275,3911879,3844483],
  [3654001,3633417,5407049,3654003,3654005,3654011,4307215,3654008,3875575,3981235,4058987,3654021,3844483],
  [3654001,3633417,4639906,3654003,3654005,3654008,3875570,3875575,3981235,3654021,3827275,3844483],
  [3654001,3633417,4027548,4639906,5407049,3654003,3654005,3654008,3875570,3981235,3654018,3654021,3827275,3844483,4472033],
  [3654001,3633417,4639906,3654003,3654005,3654008,3875570,3981235,3827275,3911879,3844483,4472033],
  [3654001,5588693,3633417,5407049,3654003,3654005,4571552,3654011,4307215,3654008,3981235,4235090,3827275,5720137,3911879,3844483],
  [3654001,3633417,3981235,3827275,3844483,5749758,5749759],
  [3654001,3633417,3844483],
  [3654001,3633417,3654003,3654005,3654011,3875570,3981235,4235090,3827275,3844483],
  [6366496,6366488,3633417,6126724,3875575,6353157],
  [3654001,3633417,3654003,3654005,4571552,3654011,4307215,3654008,3875570,3875575,3981235,4235090,3827275,5720137,3844483],
  [3654001,3633417,3654003,3654011,4307215,3654008,5720137,3844483],
  [5139311,3654001,5309546,5588693,3633417,4639906,4950468,3654003,3654005,4571552,3654011,3823920,4307215,3654008,3875570,3875575,3981235,4058987,4235090,5139309,3827275,5720137,3911879,3844483,3653977,4950470],
  [5139311,3654001,5309546,5588693,3633417,3654003,3654005,4571552,3654011,4307215,3654008,3875570,3875575,3981235,4235090,5139309,3827275,5720137,3911879,3844483],
  [3654001,3633417,6670032,3981235,6353157,3844483],
  [3654001,3633417,3654008,6353157,3911879,3844483],
  [3654001,3633417,3654003,3654005,3654011,3654008,3653894,3915180,3981235,3827275,3911879,3844483],
  [3654001,3633417,3654003,3654005,3654011,3823920,3654008,3653894,3875570,3915180,3981235,4058987,4235090,3913991,3827275,3911879,3844483,4449973,4472033],
  [3654001,3911899,3633417,4117119,3654003,3654005,3654008,3875575,3915180,3981235,3827275,3844483],
  [3654001,3633417,3654003,3654011,3654008,3875575,3981235,3827275,3844483,3653977],
  [3633417,3981235,3584605,3827275,3844483],
  [3633417,3981235,3827275,3844483],
  [3633417,3981235,3827275,3844483,4472033],
  [3633417],
  [3654001,3633417,4027548,4639906,5407049,3654003,3654005,5075934,3823922,3654011,3823920,3654016,3654008,3875580,3981235,3654018,3654021,3827275,3844483],
  [3654001,3633417,4027548,4639906,3654003,3654005,3823922,3654011,3823920,3654016,3654008,3875580,3875570,3981235,3445538,3654018,3654021,3827275,3844483],
  [3654001,3633417,4027548,4639906,3654003,3654005,3823922,3654011,3823920,3654016,3654008,3875580,3875570,3981235,3654018,3654021,3827275,3844483],
  [3654001,3633417,4027548,3654003,3654005,3654008,3875580,3875570,3981235,3654018,3654021,3827275,3844483],
  [3654001,3633417,4027548,4639906,5407049,3654003,3654005,3823922,3654011,3823920,3654016,3654008,3875580,3875570,3981235,4421965,3654018,3654021,3827275,3844483],
  [],
  [3633417,4946669,3981235,4946672,3827275,3844483],
  [3654001,3633417,3654005,3654008,3714049,3981235,3827275,3844483],
  [3654001,3633417,3654005,3654008,3981235,3827275,3844483],
  [3654001,3633417,3654005,3654008,3981235,3827275,3844483,5956803],
];
// Her Acuity booking site. BOOK_LINKS[i] = [Acuity appointment type id, photo] for MENU[i].
const BOOK_URL = 'https://queenofthekrownbooking.as.me/';
const bookLink = id => BOOK_URL + (id ? '?appointmentType=' + id : '');
const BOOK_LINKS = [
[89355221, "https://cdn-s.acuityscheduling.com/appointmentType-thumb-89355221.jpeg?1787277727"],
[97348733, "https://cdn-s.acuityscheduling.com/appointmentType-thumb-97348733.jpeg?1787274834"],
[97349229, ""],
[71000986, "https://cdn-s.acuityscheduling.com/appointmentType-71000986.jpeg?1731940726"],
[74775228, "https://cdn-s.acuityscheduling.com/appointmentType-74775228.jpeg?1740810863"],
[81094925, "https://cdn-s.acuityscheduling.com/appointmentType-81094925.jpeg?1753034923"],
[73716924, "https://cdn-s.acuityscheduling.com/appointmentType-73716924.jpeg?1738114403"],
[46922527, "https://cdn-s.acuityscheduling.com/appointmentType-46922527.jpeg?1684318594"],
[43482451, "https://cdn-s.acuityscheduling.com/appointmentType-43482451.jpeg?1740119390"],
[63282151, "https://cdn-s.acuityscheduling.com/appointmentType-63282151.jpg?1716007606"],
[75111065, "https://cdn-s.acuityscheduling.com/appointmentType-thumb-75111065.jpeg?1785120474"],
[86934793, "https://cdn-s.acuityscheduling.com/appointmentType-86934793.jpeg?1768510215"],
[77103463, "https://cdn-s.acuityscheduling.com/appointmentType-77103463.jpeg?1744911979"],
[84886707, "https://cdn-s.acuityscheduling.com/appointmentType-84886707.jpeg?1787275007"],
[76040229, ""],
[89591578, ""],
[41991493, "https://cdn-s.acuityscheduling.com/appointmentType-41991493.jpeg?1692273570"],
[59006470, "https://cdn-s.acuityscheduling.com/appointmentType-59006470.jpeg?1723759943"],
[84687537, "https://cdn-s.acuityscheduling.com/appointmentType-thumb-84687537.jpeg?1784392555"],
[84885480, "https://cdn-s.acuityscheduling.com/appointmentType-thumb-84885480.jpeg?1761243571"],
[41987965, "https://cdn-s.acuityscheduling.com/appointmentType-thumb-41987965.jpeg?1677256368"],
[41992356, "https://cdn-s.acuityscheduling.com/appointmentType-41992356.jpeg?1677260089"],
[43482272, "https://cdn-s.acuityscheduling.com/appointmentType-43482272.jpeg?1702489422"],
[67377658, "https://cdn-s.acuityscheduling.com/appointmentType-thumb-67377658.jpeg?1723759742"],
[41989675, "https://cdn-s.acuityscheduling.com/appointmentType-thumb-41989675.jpeg?1677257826"],
[41990992, "https://cdn-s.acuityscheduling.com/appointmentType-thumb-41990992.jpeg?1677258922"],
[63291105, "https://cdn-s.acuityscheduling.com/appointmentType-thumb-63291105.jpg?1716043114"],
[87949943, ""],
[41991634, "https://cdn-s.acuityscheduling.com/appointmentType-41991634.jpeg?1677259522"],
[40337358, "https://cdn-s.acuityscheduling.com/appointmentType-40337358.jpeg?1677253683"],
[40337410, "https://cdn-s.acuityscheduling.com/appointmentType-40337410.jpeg?1679928300"],
[48595650, "https://cdn-s.acuityscheduling.com/appointmentType-48595650.jpeg?1697812476"],
[43039643, "https://cdn-s.acuityscheduling.com/appointmentType-43039643.jpeg?1678800120"],
[94685762, ""],
[43463665, ""],
[44673961, ""],
[59383267, ""],
[66060059, ""],
];
const DEFAULT_POLICIES = `Located in Charlotte, NC. Questions or photos of your hair: text 704-614-3287.

THICK HAIR: select it as an add-on, or there will be an extra charge when you arrive.
Your hair must be at least 5 inches long all around. Not sure? Text a picture first.

LATE / CANCELLED APPOINTMENTS
• Cancel at least 24 hours before, by texting 704-614-3287 only.
• 10 minute grace period. 10+ minutes late = $15 late fee. 15+ minutes late = appointment cancelled.
• No call / no show = no future appointments.
• Deposits are NON-REFUNDABLE.
• Same-day cancellation = charged 100% of the service.

BEFORE YOUR APPOINTMENT
• No changes after you book and send your deposit.
• Hair must be washed well and blown out as straight as possible, root to ends, with NO product in it. Natural hair: fully detangle and blow out with a brush.
• If your fingers can't run through it easily, detangle more (tip: paddle brush + blow dryer together).
• Hair that isn't washed, blown out and product-free gets an inconvenience fee.

COLORS
• Hair is provided for all services, in colors 1, 1B, 2, 4, 27 and 30 only. Any other color you buy yourself.
• After booking, text 704-614-3287 to find out which brand of hair to get.

PHOTOS / VIDEOS
• Content from appointments is used to promote the business. If you'd rather not be photographed or recorded, say so before your appointment starts.

Thank you, Kheris Sharp`;
