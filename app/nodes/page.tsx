"use client";
import {useState, useRef, useEffect} from "react";

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
  const exploreTopics = async (topic: string): Promise<string[]> => {
    console.log('Fetching topics for:', topic);
    try {
      const response = await fetch('/api/explore-topic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic }),
      });
      
      console.log('API Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to fetch related topics: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('API Response data:', data);
      console.log('API response:', data);
      if (!data.topics || !Array.isArray(data.topics)) {
        console.error('Invalid response format:', data);
        return [];
      }
      return data.topics;
    } catch (error) {
      console.error('Error exploring topics:', error);
      return [];
    }
  };

  const [nodes, setNodes] = useState<Node[]>(() => {
    if (typeof window !== 'undefined') {
      const savedNodes = localStorage.getItem('nodes');
      return savedNodes ? JSON.parse(savedNodes) : [{
        id: "root",
        x: 1000,
        y: 1000,
        text: "Artificial Intelligence",
        level: 0,
      }];
    }
    return [{
      id: "root",
      x: 1000,
      y: 1000,
      text: "Artificial Intelligence",
      level: 0,
    }];
  });

  const [connections, setConnections] = useState<{from: string; to: string}[]>(() => {
    if (typeof window !== 'undefined') {
      const savedConnections = localStorage.getItem('connections');
      return savedConnections ? JSON.parse(savedConnections) : [];
    }
    return [];
  });
  const [canvasOffset, setCanvasOffset] = useState({x: 0, y: 0});
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({x: 0, y: 0});
  const [lastOffset, setLastOffset] = useState({x: 0, y: 0});
  const [zoom, setZoom] = useState(1);
  const [isPhysicsEnabled, setIsPhysicsEnabled] = useState(true);
  const [showBurrowAnimation, setShowBurrowAnimation] = useState(false);
  const [showRabbitHole, setShowRabbitHole] = useState(false);
  const [holeAnimation, setHoleAnimation] = useState<
    "appear" | "zoom" | "done"
  >("appear");
  const [loadingNode, setLoadingNode] = useState<string | null>(null);
  const [errorNode, setErrorNode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const handleBurrow = () => {
    setShowBurrowAnimation(true);
    setTimeout(() => {
      setShowBurrowAnimation(false);
      setShowRabbitHole(true);
      setHoleAnimation("appear");

      // Start zoom animation after 1 second
      setTimeout(() => {
        setHoleAnimation("zoom");

        // Hide the hole after zoom animation completes
        setTimeout(() => {
          setHoleAnimation("done");
          setShowRabbitHole(false);
        }, 2000);
      }, 1000);
    }, 2000);
  };

  // Function to center the view on a specific node
  const centerOnNode = (node: Node) => {
    if (containerRef.current) {
      const centerX = containerRef.current.clientWidth / 2;
      const centerY = containerRef.current.clientHeight / 2;

      // Account for zoom level when calculating the offset
      const offsetX = centerX - node.x * zoom;
      const offsetY = centerY - node.y * zoom;

      setCanvasOffset({x: offsetX, y: offsetY});
    }
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

  const generateNewNodes = async (parentNode: Node) => {
    console.log('Generating new nodes for:', parentNode.text);
    setLoadingNode(parentNode.id);
    try {
      // Get related topics from the API
      const relatedTopics = await exploreTopics(parentNode.text);
      console.log('Received topics:', relatedTopics);
      
      if (!relatedTopics || relatedTopics.length === 0) {
        console.error('No related topics found for:', parentNode.text);
        return;
      }

    const newNodes: Node[] = [];
    const newConnections: {from: string; to: string}[] = [];
    const radius = 300; // Base radius for spacing

    // Determine if this is the root node (no parent)
    const isRootNode = !parentNode.parentId;

    if (isRootNode) {
      // For root node, generate 5 nodes in a full circle
      const angleStep = (2 * Math.PI) / 5;

      const numTopics = Math.min(relatedTopics.length, 5);
      for (let i = 0; i < numTopics; i++) {
        const angle = i * angleStep;
        const x = parentNode.x + Math.cos(angle) * radius;
        const y = parentNode.y + Math.sin(angle) * radius;

        const newNode: Node = {
          id: `${parentNode.id}-${i}`,
          x,
          y,
          text: relatedTopics[i],
          level: parentNode.level + 1,
          parentId: parentNode.id,
        };

        newNodes.push(newNode);
        newConnections.push({from: parentNode.id, to: newNode.id});
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
            node.id === parentNode.id ? {...node, x: newX, y: newY} : node
          )
        );

        // Update parentNode reference for the rest of the function
        parentNode = {...parentNode, x: newX, y: newY};

        // Generate nodes based on available topics in a 120-degree arc
        const numTopics = Math.min(relatedTopics.length, 3);
        for (let i = 0; i < numTopics; i++) {
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
            text: relatedTopics[i],
            level: parentNode.level + 1,
            parentId: parentNode.id,
          };

          newNodes.push(newNode);
          newConnections.push({from: parentNode.id, to: newNode.id});
        }
      }
    }

    console.log(`Total nodes created: ${newNodes.length}`);

    setNodes((prev: Node[]) => [...prev, ...newNodes]);
    setConnections((prev) => [...prev, ...newConnections]);

    // Center the view on the parent node after adding new nodes
    setTimeout(() => centerOnNode(parentNode), 100);
  } catch (error) {
    console.error('Error generating nodes:', error);
  } finally {
    setLoadingNode(null);
  }
  };

    const handleNodeClick = async (node: Node, event: React.MouseEvent) => {
    console.log('Node clicked:', node.text);
    // Prevent node click when dragging
    if (isDragging) {
      console.log('Click ignored - dragging');
      return;
    }

    // Check if node is already loading
    if (loadingNode === node.id) {
      console.log('Node is already loading, ignoring click');
      return;
    }

    // Mark the node as clicked
    setNodes((prev) =>
      prev.map((n: Node) => (n.id === node.id ? {...n, isClicked: true} : n))
    );

    // Only generate new nodes if this node doesn't have children yet
    const hasChildren = connections.some((conn) => conn.from === node.id);
    console.log('Has children:', hasChildren);
    
    if (!hasChildren) {
      console.log('Generating new nodes for:', node.text);
      await generateNewNodes(node);
    } else {
      console.log('Node already has children, skipping generation');
    }
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({x: event.clientX, y: event.clientY});
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
      setCanvasOffset({x: newOffsetX, y: newOffsetY});
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

  return (
    <div
      style={{position: "fixed", inset: 0, overflow: "hidden"}}
      className="bg-[#fff0d2]"
    >
      {/* Burrow animation */}
      {showBurrowAnimation && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div
            className="text-[#000000] text-4xl font-bold"
            style={{
              animation: "burrowText 2s ease-in-out forwards",
            }}
          >
            new rabbit hole discovered
          </div>
        </div>
      )}

      {/* Black overlay for fade effect */}
      {holeAnimation === "zoom" && (
        <div
          className="fixed inset-0 bg-black z-30 pointer-events-none"
          style={{
            animation: "fadeIn 2s ease-in forwards",
          }}
        ></div>
      )}

      {/* Rabbit Hole */}
      {showRabbitHole && (
        <div className="fixed inset-0 flex items-center justify-center z-40 pointer-events-none">
          <div
            className="w-40 h-40 rounded-full"
            style={{
              background:
                "radial-gradient(circle at center, #8B4513 0%, #654321 60%, #3D2B1F 100%)",
              boxShadow: "inset 0 -8px 20px rgba(0,0,0,0.6)",
              transform: "perspective(1000px) rotateX(60deg)",
              animation: `${
                holeAnimation === "appear"
                  ? "holeAppear 0.5s ease-out forwards"
                  : holeAnimation === "zoom"
                  ? "holeZoom 2s ease-in forwards"
                  : "none"
              }`,
            }}
          ></div>
        </div>
      )}

      {/* Control buttons */}
      <div className="absolute top-4 right-4 z-10 flex gap-4">
        <button
          onClick={handleBurrow}
          className="px-4 py-2 bg-[#1e00ff] text-[#fff0d2] rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 text-sm font-medium"
        >
          Burrow
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
            >
              <div
                className={`w-16 h-16 rounded-full text-[#fff0d2] flex items-center justify-center text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300 ${
                  node.isClicked ? "bg-[#D2B48C]" : "bg-[#1e00ff]"
                } ${loadingNode === node.id ? 'animate-pulse' : ''}`}
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

      <style jsx>{`
        @keyframes holeAppear {
          0% {
            transform: perspective(1000px) rotateX(60deg) scale(0);
            opacity: 0;
          }
          100% {
            transform: perspective(1000px) rotateX(60deg) scale(1);
            opacity: 1;
          }
        }

        @keyframes holeZoom {
          0% {
            transform: perspective(1000px) rotateX(60deg) scale(1);
          }
          100% {
            transform: perspective(1000px) rotateX(0deg) scale(15);
            opacity: 0;
          }
        }

        @keyframes fadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes burrowText {
          0% {
            opacity: 0;
            transform: scale(0.5) translateY(20px);
          }
          20% {
            opacity: 1;
            transform: scale(1.1) translateY(0);
          }
          30% {
            transform: scale(1) translateY(0);
          }
          80% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          100% {
            opacity: 0;
            transform: scale(0.9) translateY(-20px);
          }
        }
      `}</style>
    </div>
  );
}
