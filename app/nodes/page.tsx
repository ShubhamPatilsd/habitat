"use client";
import { useState, useRef, useEffect } from "react";
interface Node {
  id: string;
  x: number;
  y: number;
  text: string;
  level: number;
  parentId?: string;
  isClicked?: boolean;
  isCurrentNode?: boolean; // Track which node is currently active
  isBurrowed?: boolean; // Track burrowed nodes
}
export default function NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([
    {
      id: "root",
      x: 1000,
      y: 1000,
      text: "Start",
      level: 0,
      isCurrentNode: false, // Changed: Start node is blue, not current
    },
  ]);
  const [connections, setConnections] = useState<
    { from: string; to: string }[]
  >([]);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastOffset, setLastOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPhysicsEnabled, setIsPhysicsEnabled] = useState(true);
  const [topics, setTopics] = useState<string[]>(["next1"]);
  const [currTopic, setCurrTopic] = useState<string>("next1");
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  // popup + fullscreen states
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [expandedNode, setExpandedNode] = useState<Node | null>(null);
  const [hoverTimer, setHoverTimer] = useState<NodeJS.Timeout | null>(null);
  // Function to center the view on a specific node
  const centerOnNode = (node: Node) => {
    if (containerRef.current) {
      const centerX = containerRef.current.clientWidth / 2;
      const centerY = containerRef.current.clientHeight / 2;
      // Account for zoom level when calculating the offset
      const offsetX = centerX - node.x * zoom;
      const offsetY = centerY - node.y * zoom;
      setCanvasOffset({ x: offsetX, y: offsetY });
    }
  };
  const handleResetView = () => {
    const resetZoom = 1;
    setZoom(resetZoom);
    if (containerRef.current && nodes.length > 0) {
      const node = nodes[0];
      const centerX = containerRef.current.clientWidth / 2;
      const centerY = containerRef.current.clientHeight / 2;
      const offsetX = centerX - node.x * resetZoom;
      const offsetY = centerY - node.y * resetZoom;
      setCanvasOffset({ x: offsetX, y: offsetY });
    }
  };
  const handleResetPrevious = () => {
    if (containerRef.current && nodes.length > 1) {
      // ✅ find the most recently created parent node (has children)
      const latestParent = [...nodes]
        .reverse()
        .find((node) => nodes.some((child) => child.parentId === node.id));
      if (!latestParent) return;
      const resetZoom = 1;
      setZoom(resetZoom);
      const centerX = containerRef.current.clientWidth / 2;
      const centerY = containerRef.current.clientHeight / 2;
      const offsetX = centerX - latestParent.x * resetZoom;
      const offsetY = centerY - latestParent.y * resetZoom;
      setCanvasOffset({ x: offsetX, y: offsetY });
    }
  };
  const handleBurrow = () => {
    // Find the current node and transform it into a burrow
    const currentNode = nodes.find(node => node.isCurrentNode);
    
    if (currentNode) {
      // Mark the current node as burrowed (removes text and makes it look like a hole)
      setNodes(prev => 
        prev.map(node => 
          node.id === currentNode.id 
            ? { ...node, isBurrowed: true, isCurrentNode: false }
            : node
        )
      );
    }
    try {
      // Save current state with the burrow applied
      const nodesWithBurrow = nodes.map(node => 
        currentNode && node.id === currentNode.id 
          ? { ...node, isBurrowed: true, isCurrentNode: false }
          : node
      );
      localStorage.setItem(currTopic, JSON.stringify(nodesWithBurrow));
    } catch (error) {
      console.error("Failed to save nodes to local storage:", error);
    }
    // ✅ just update topics & reset canvas
    setTopics((prev) => [...prev, `next${prev.length + 1}`]);
    setCurrTopic("next" + (topics.length + 1));
    // reset graph - start node is blue, not current
    setNodes([{ id: "root", x: 1000, y: 1000, text: "Start", level: 0, isCurrentNode: false }]);
    setConnections([]);
    centerOnNode({ id: "root", x: 1000, y: 1000, text: "Start", level: 0 });
  };
  // Center the canvas on the starting node when component mounts
  useEffect(() => {
    const centerCanvas = () => centerOnNode(nodes[0]);
    // Center with a small delay to ensure container is rendered
    const timeoutId = setTimeout(centerCanvas, 100);
    // Also center on window resize
    window.addEventListener("resize", centerCanvas);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", centerCanvas);
    };
  }, []);
  const generateNewNodes = (parentNode: Node) => {
    const newNodes: Node[] = [];
    const newConnections: { from: string; to: string }[] = [];
    const radius = 300; // Base radius for spacing
    // Determine if this is the root node (no parent)
    const isRootNode = !parentNode.parentId;
    if (isRootNode) {
      // For root node, generate 5 nodes in a full circle
      const angleStep = (2 * Math.PI) / 5;
      for (let i = 0; i < 5; i++) {
        const angle = i * angleStep;
        const x = parentNode.x + Math.cos(angle) * radius;
        const y = parentNode.y + Math.sin(angle) * radius;
        const newNode: Node = {
          id: `${parentNode.id}-${i}`,
          x,
          y,
          text: `Node ${i + 1}`,
          level: parentNode.level + 1,
          parentId: parentNode.id,
        };
        newNodes.push(newNode);
        newConnections.push({ from: parentNode.id, to: newNode.id });
      }
    } else {
      // For non-root nodes, first find the direction to the parent
      const parent = nodes.find((n: Node) => n.id === parentNode.parentId);
      if (parent) {
        // Calculate direction from parent to current node
        const dx = parentNode.x - parent.x;
        const dy = parentNode.y - parent.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Normalize the direction vector
        const dirX = dx / distance;
        const dirY = dy / distance;
        // Calculate the perpendicular vector (both directions)
        const perpX = -dirY;
        const perpY = dirX;
        // Move the parent node further away from its parent
        const newX = parent.x + (dx / distance) * distance * 2;
        const newY = parent.y + (dy / distance) * distance * 2;
        // Update the parent node position
        setNodes((prev) =>
          prev.map((node: Node) =>
            node.id === parentNode.id ? { ...node, x: newX, y: newY } : node
          )
        );
        // Update parentNode reference for the rest of the function
        parentNode = { ...parentNode, x: newX, y: newY };
        // Generate 3 nodes in a 120-degree arc away from the parent
        for (let i = 0; i < 3; i++) {
          // Calculate angle for spreading nodes in a 120-degree arc
          const spreadAngle = (Math.PI / 3) * (i - 2.5); // -60 to +60 degrees
          // Rotate the perpendicular vector by spreadAngle
          const rotatedX =
            perpX * Math.cos(spreadAngle) - perpY * Math.sin(spreadAngle);
          const rotatedY =
            perpX * Math.sin(spreadAngle) + perpY * Math.cos(spreadAngle);
          // Position the new node
          const x = parentNode.x + rotatedX * radius;
          const y = parentNode.y + rotatedY * radius;
          const newNode: Node = {
            id: `${parentNode.id}-${i}`,
            x,
            y,
            text: `Node ${i + 1}`,
            level: parentNode.level + 1,
            parentId: parentNode.id,
          };
          newNodes.push(newNode);
          newConnections.push({ from: parentNode.id, to: newNode.id });
        }
      }
    }
    // console.log(`Total nodes created: ${newNodes.length}`);
    setNodes((prev: Node[]) => [...prev, ...newNodes]);
    setConnections((prev) => [...prev, ...newConnections]);
    // Center the view on the parent node after adding new nodes
    setTimeout(() => centerOnNode(parentNode), 100);
  };
  const handleNodeClick = (node: Node, event: React.MouseEvent) => {
    if (isDragging) return;
    
    // Don't allow clicking on burrowed nodes
    if (node.isBurrowed) return;
    // If clicking on a grey node (previously visited), open fullscreen
    if (node.isClicked && !node.isCurrentNode) {
      setExpandedNode(node);
      return;
    }
    // If clicking on current node (beige) OR a blue node (unvisited)
    if (node.isCurrentNode || (!node.isClicked && !node.isCurrentNode)) {
      // If it's a blue node, update states first
      if (!node.isCurrentNode) {
        setNodes((prev) =>
          prev.map((n) => ({
            ...n,
            isClicked: n.isCurrentNode ? true : n.isClicked, // Previous current becomes grey (clicked)
            isCurrentNode: n.id === node.id, // This blue node becomes current (beige)
          }))
        );
      }
      // Generate children if they don't exist
      const hasChildren = nodes.some((n) => n.parentId === node.id);
      if (!hasChildren) {
        generateNewNodes(node);
      }
    }
  };
  const handleMouseDown = (event: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: event.clientX, y: event.clientY });
    setLastOffset(canvasOffset);
  };
  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = event.clientX - dragStart.x;
    const deltaY = event.clientY - dragStart.y;
    setCanvasOffset({
      x: lastOffset.x + deltaX,
      y: lastOffset.y + deltaY,
    });
  };
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  const handleMouseLeave = () => {
    setIsDragging(false);
  };
  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY;
    const zoomFactor = 0.1;
    const newZoom = Math.max(
      0.1,
      Math.min(5, zoom + (delta > 0 ? -zoomFactor : zoomFactor))
    );
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      // Calculate the point under the mouse before zoom
      const worldX = (mouseX - canvasOffset.x) / zoom;
      const worldY = (mouseY - canvasOffset.y) / zoom;
      // Calculate new offset to keep the point under the mouse in the same place
      const newOffsetX = mouseX - worldX * newZoom;
      const newOffsetY = mouseY - worldY * newZoom;
      setZoom(newZoom);
      setCanvasOffset({ x: newOffsetX, y: newOffsetY });
    }
  };
  // Physics simulation for node repulsion
  const applyPhysics = () => {
    if (!isPhysicsEnabled) return;
    setNodes((prevNodes: Node[]) => {
      const newNodes = [...prevNodes];
      const normalRepulsionForce = 50000; // Normal repulsion strength
      const parentRepulsionForce = 500000; // Much stronger repulsion for parent nodes
      const damping = 0.9; // Damping factor to prevent oscillation
      const minDistance = 100; // Minimum distance between nodes
      const parentMinDistance = 200; // Larger minimum distance for parent nodes
      // Apply repulsion forces between all pairs of nodes
      for (let i = 0; i < newNodes.length; i++) {
        for (let j = i + 1; j < newNodes.length; j++) {
          const node1 = newNodes[i];
          const node2 = newNodes[j];
          const dx = node2.x - node1.x;
          const dy = node2.y - node1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          // Check if either node is a parent (has children)
          const node1IsParent = prevNodes.some(
            (n: Node) => n.parentId === node1.id
          );
          const node2IsParent = prevNodes.some(
            (n: Node) => n.parentId === node2.id
          );
          const bothAreParents = node1IsParent && node2IsParent;
          // Use different parameters for parent nodes
          const repulsionForce = bothAreParents
            ? parentRepulsionForce
            : normalRepulsionForce;
          const effectiveMinDistance = bothAreParents
            ? parentMinDistance
            : minDistance;
          if (distance < effectiveMinDistance && distance > 0) {
            // Calculate repulsion force (inverse square law)
            const force = repulsionForce / (distance * distance);
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            // Apply forces (with damping)
            newNodes[i] = {
              ...node1,
              x: node1.x - fx * damping,
              y: node1.y - fy * damping,
            };
            newNodes[j] = {
              ...node2,
              x: node2.x + fx * damping,
              y: node2.y + fy * damping,
            };
          }
        }
      }
      return newNodes;
    });
  };
  // Animation loop for physics
  useEffect(() => {
    const animate = () => {
      applyPhysics();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    if (isPhysicsEnabled) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPhysicsEnabled]);
  const handleTopicClick = (topic: string) => {
    try {
      localStorage.setItem(currTopic, JSON.stringify(nodes));
    } catch (error) {
      console.error("Failed to save nodes to local storage:", error);
    }
    try {
      const savedNodesJson = localStorage.getItem(topic);
      if (savedNodesJson) {
        const foundNodes = JSON.parse(savedNodesJson) as Node[];
        setNodes(foundNodes);
        // Reset connections when loading new nodes
        setConnections([]);
      }
    } catch (error) {
      console.error(`Failed to load nodes for topic ${topic}:`, error);
    }
    setCurrTopic(topic);
  };
  // Function to get node style based on state
  const getNodeStyle = (node: Node) => {
    if (node.isBurrowed) {
      // Burrow appearance - brown hole-like style with no text
      return {
        background: "radial-gradient(circle at center, #8B4513 0%, #654321 60%, #3D2B1F 100%)",
        boxShadow: "inset 0 -8px 20px rgba(0,0,0,0.6)",
        transform: "perspective(300px) rotateX(45deg)",
      };
    } else if (node.isCurrentNode) {
      return { backgroundColor: "#D2B48C" }; // Beige for current node
    } else if (node.isClicked) {
      return { backgroundColor: "#808080" }; // Grey for previously visited nodes
    } else {
      return { backgroundColor: "#1e00ff" }; // Blue for unvisited nodes
    }
  };
  return (
    <div
      style={{ position: "fixed", inset: 0, overflow: "hidden" }}
      className="bg-[#fff0d2]"
    >
      {/* Isometric 3D stack display with max 10 + underline current */}
      <div className="fixed left-4 top-4 z-50">
        <svg width="260" height={Math.min(topics.length, 10) * 80 + 100}>
          {topics.slice(0, 10).map((topic, i) => {
            const x = 40;
            const y = 40 + i * 60; // vertical stacking
            const width = 160;
            const height = 40;
            const depth = 12;
            const isActive = currTopic === topic; // ✅ check if this panel is current
            return (
              <g
                key={topic}
                className="cursor-pointer"
                onClick={() => handleTopicClick(topic)}
              >
                {/* Top face */}
                <polygon
                  points={`
              ${x},${y}
              ${x + width},${y}
              ${x + width - 20},${y + height}
              ${x - 20},${y + height}
            `}
                  fill="white"
                  stroke="#1e00ff"
                  strokeWidth="1.5"
                />
                {/* Side face */}
                <polygon
                  points={`
              ${x - 20},${y + height}
              ${x + width - 20},${y + height}
              ${x + width - 20},${y + height + depth}
              ${x - 20},${y + height + depth}
            `}
                  fill="#e0e0ff"
                  stroke="#1e00ff"
                  strokeWidth="1"
                />
                {/* Front face */}
                <polygon
                  points={`
              ${x + width},${y}
              ${x + width - 20},${y + height}
              ${x + width - 20},${y + height + depth}
              ${x + width},${y + depth}
            `}
                  fill="#c0c0ff"
                  stroke="#1e00ff"
                  strokeWidth="1"
                />
                {/* Label */}
                <text
                  x={x + width / 2}
                  y={y + height / 2}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  fontSize="14"
                  fill="#1e00ff"
                  fontWeight="bold"
                  textDecoration={isActive ? "underline" : "none"} // ✅ underline active
                >
                  {topic}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {/* Control buttons */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={handleBurrow}
          className="px-4 py-2 bg-[#1e00ff] text-[#fff0d2] rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 text-sm font-medium"
        >
          Burrow
        </button>
        <button
          onClick={handleResetView}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 text-sm font-medium"
        >
          Reset View
        </button>
        <button
          onClick={handleResetPrevious}
          className="px-4 py-2 bg-gray-500 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 text-sm font-medium"
        >
          Reset Previous
        </button>
      </div>
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        {/* Infinite canvas container */}
        <div
          className="absolute"
          style={{
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: "200vw",
            height: "200vh",
            left: "0vw",
            top: "0vh",
            transition: "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {/* Render nodes */}
          {nodes.map((node) => (
            <div
              key={node.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 hover:scale-110"
              style={{
                left: node.x,
                top: node.y,
              }}
              onClick={(e) => handleNodeClick(node, e)}
              onMouseEnter={() => {
                if (node.isClicked && !node.isCurrentNode && !node.isBurrowed) {
                  const timer = setTimeout(() => {
                    setHoveredNode(node);
                    setShowPopup(true);
                  }, 400);
                  setHoverTimer(timer);
                }
              }}
              onMouseLeave={() => {
                if (node.isClicked && !node.isCurrentNode && !node.isBurrowed) {
                  if (hoverTimer) clearTimeout(hoverTimer);
                  setHoverTimer(null);
                  setHoveredNode(null);
                  setShowPopup(false);
                }
              }}
            >
              <div
                className="w-16 h-16 rounded-full text-[#fff0d2] flex items-center justify-center text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                style={{
                  ...getNodeStyle(node),
                  animation:
                    node.level === 0 ? "none" : "nodeAppear 0.5s ease-out",
                }}
              >
                {/* Only show text if not burrowed */}
                {!node.isBurrowed && node.text}
              </div>
            </div>
          ))}
        </div>
      </div>
      <style jsx>{`
        @keyframes nodeAppear {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
      {/* Hover popup */}
      {showPopup && hoveredNode && (
        <div
          className="absolute bg-white shadow-lg rounded-lg p-4 z-50"
          style={{
            // project node position into screen space
            left: hoveredNode.x * zoom + canvasOffset.x + 80,
            top: hoveredNode.y * zoom + canvasOffset.y - 40,
            width: "200px",
            transform: "translate(-50%, -100%)", // keep it centered above
          }}
        >
          <h3 className="font-semibold">{hoveredNode.text}</h3>
          <p className="text-sm text-gray-600">Quick preview content…</p>
        </div>
      )}
      {/* Fullscreen expanded */}
      {expandedNode && (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
          <div className="bg-white w-[80%] h-[80%] rounded-lg shadow-xl p-6 relative">
            <button
              onClick={() => setExpandedNode(null)}
              className="absolute top-2 right-2 px-3 py-1 bg-gray-200 rounded"
            >
              Close
            </button>
            <h2 className="text-xl font-bold mb-4">{expandedNode.text}</h2>
            <p className="text-gray-700">
              Expanded rabbit hole content goes here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}