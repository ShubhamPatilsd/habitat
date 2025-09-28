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
}

export default function NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([
    {
      id: "root",
      x: 1000,
      y: 1000,
      text: "Start",
      level: 0,
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
    try {
      localStorage.setItem(currTopic, JSON.stringify(nodes));
    } catch (error) {
      console.error("Failed to save nodes to local storage:", error);
    }

    // ✅ just update topics & reset canvas
    setTopics((prev) => [...prev, `next${prev.length + 1}`]);
    setCurrTopic("next" + (topics.length + 1));

    // reset graph
    setNodes([{ id: "root", x: 1000, y: 1000, text: "Start", level: 0 }]);
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

    if (node.isClicked) {
      // grey nodes → open fullscreen
      setExpandedNode(node);
      return;
    }

    // normal behavior: mark as clicked + spawn children
    setNodes((prev) =>
      prev.map((n) => (n.id === node.id ? { ...n, isClicked: true } : n))
    );

    const hasChildren = nodes.some((n) => n.parentId === node.id);
    if (!hasChildren) {
      generateNewNodes(node);
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
    // Save current topic state
    localStorage.setItem(currTopic, JSON.stringify(nodes));
  } catch (error) {
    console.error("Failed to save nodes to local storage:", error);
  }

  try {
    const savedNodesJson = localStorage.getItem(topic);
    if (savedNodesJson) {
      const foundNodes = JSON.parse(savedNodesJson) as Node[];
      setNodes(foundNodes);
      setConnections([]);

      // ✅ Reset zoom + center on root node after switching
      setTimeout(() => {
        if (foundNodes.length > 0) {
          setZoom(1); // reset zoom
          centerOnNode(foundNodes[0]); // center on root
        }
      }, 50);
    }
  } catch (error) {
    console.error(`Failed to load nodes for topic ${topic}:`, error);
  }

  setCurrTopic(topic);
};

  // Smooth keyboard navigation (WASD + Arrow keys + zoom)
  useEffect(() => {
    const keysPressed = new Set<string>();
    let animationFrameId: number;

    const step = 10; // smaller step size per frame for smoothness

    const move = () => {
      setCanvasOffset((prev) => {
        let { x, y } = prev;
        if (
          keysPressed.has("ArrowUp") ||
          keysPressed.has("w") ||
          keysPressed.has("W")
        ) {
          y += step;
        }
        if (
          keysPressed.has("ArrowDown") ||
          keysPressed.has("s") ||
          keysPressed.has("S")
        ) {
          y -= step;
        }
        if (
          keysPressed.has("ArrowLeft") ||
          keysPressed.has("a") ||
          keysPressed.has("A")
        ) {
          x += step;
        }
        if (
          keysPressed.has("ArrowRight") ||
          keysPressed.has("d") ||
          keysPressed.has("D")
        ) {
          x -= step;
        }
        return { x, y };
      });

      animationFrameId = requestAnimationFrame(move);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      keysPressed.add(event.key);

      // prevent browser scrolling with arrow keys
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(
          event.key
        )
      ) {
        event.preventDefault();
      }

      // Zoom handling
      if (event.key === "+" || event.key === "=") {
        setZoom((prev) => Math.min(5, prev + 0.05));
      }
      if (event.key === "-") {
        setZoom((prev) => Math.max(0.1, prev - 0.05));
      }

      // Start animation loop if not already running
      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(move);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keysPressed.delete(event.key);

      // Stop animation if no keys are held
      if (keysPressed.size === 0 && animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

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
          Reset Original
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
                if (node.isClicked) {
                  const timer = setTimeout(() => {
                    setHoveredNode(node);
                    setShowPopup(true);
                  }, 400);
                  setHoverTimer(timer);
                }
              }}
              onMouseLeave={() => {
                if (node.isClicked) {
                  if (hoverTimer) clearTimeout(hoverTimer);
                  setHoverTimer(null);
                  setHoveredNode(null);
                  setShowPopup(false);
                }
              }}
            >
              <div
                className={`w-16 h-16 rounded-full text-[#fff0d2] flex items-center justify-center text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300 ${
                  node.isClicked ? "bg-[#D2B48C]" : "bg-[#1e00ff]"
                }`}
                style={{
                  animation:
                    node.level === 0 ? "none" : "nodeAppear 0.5s ease-out",
                }}
              >
                {node.text}
              </div>
            </div>
          ))}
        </div>
      </div>

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
