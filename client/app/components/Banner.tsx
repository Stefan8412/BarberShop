export function Banner() {
  return (
    <div className="w-[320px] sm:w-[375px] mx-auto bg-black p-4 rounded-2xl shadow-xl">
      <div className="flex items-center gap-4">
        <div className="bg-white rounded-full p-3">
          <svg 
            className="w-6 h-6 text-black" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M6 9c1.5 0 3-1.5 3-3S7.5 3 6 3 3 4.5 3 6s1.5 3 3 3m0 9c1.5 0 3-1.5 3-3s-1.5-3-3-3-3 1.5-3 3 1.5 3 3 3M21 9c-1.5 0-3-1.5-3-3s1.5-3 3-3 3 1.5 3 3-1.5 3-3 3m0 9c-1.5 0-3-1.5-3-3s1.5-3 3-3 3 1.5 3 3-1.5 3-3 3M6.2 18l12.8-12M6.2 6l12.8 12"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">BarberShop</h1>
          <p className="text-gray-400 text-sm">Estilo y profesionalismo</p>
        </div>
      </div>
    </div>
  );
}
