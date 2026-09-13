export default function Footer() {
  return (
    <footer className="wl-footer">
      <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="wl-footer__brand">Wanderlust</div>
        <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-slate-600">
          <a href="#" className="hover:text-[#003527] transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-[#003527] transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-[#003527] transition-colors">Press Kit</a>
          <a href="#" className="hover:text-[#003527] transition-colors">Contact Us</a>
          <a href="#" className="hover:text-[#003527] transition-colors">Careers</a>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          © 2026 Wanderlust Travel Co. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
