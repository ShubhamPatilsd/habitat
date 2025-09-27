export default function NodePage() {
  return (
    <div className="min-h-screen bg-[#fff0d2] p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-[#1e00ff] mb-8">Rabbit Hole Explorer</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 border border-[#1e00ff]/20">
          <h2 className="text-2xl font-semibold text-[#1e00ff] mb-4">Knowledge Graph</h2>
          <p className="text-gray-600 mb-6">
            This is where your rabbit hole exploration graphs will be displayed.
            The diving animation has successfully transported you here!
          </p>
          
          {/* Placeholder for graph visualization */}
          <div className="w-full h-96 bg-gradient-to-br from-[#1e00ff]/10 to-[#fff0d2] rounded-lg border-2 border-dashed border-[#1e00ff]/30 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">🔗</div>
              <p className="text-[#1e00ff] font-medium">Graph visualization will appear here</p>
              <p className="text-gray-500 text-sm mt-2">Connect nodes, explore relationships, dive deeper into knowledge</p>
            </div>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <button 
            onClick={() => window.history.back()}
            className="bg-[#1e00ff] text-[#fff0d2] px-6 py-3 rounded-lg hover:bg-[#1e00ff]/80 transition-colors"
          >
            ← Back to Habitat
          </button>
        </div>
      </div>
    </div>
  );
}
