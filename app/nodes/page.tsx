"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
interface Node {
  id: string;
  x: number;
  y: number;
  text: string;
  description?: string; // Add description field
  richContent?: any; // Add rich content field
  level: number;
  parentId?: string;
  isClicked?: boolean;
  isCurrentNode?: boolean; // Track which node is currently active
  isBurrowed?: boolean; // Track burrowed nodes
  isFaded?: boolean; // Track if node should be faded (sibling of current path)
}
export default function NodesPage() {
  // Removed nodeIdCounter - using UUIDs instead
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connections, setConnections] = useState<
    { from: string; to: string }[]
  >([]);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastOffset, setLastOffset] = useState({ x: 0, y: 0 });
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [nodeDragStart, setNodeDragStart] = useState({ x: 0, y: 0 });
  const [usedTopics, setUsedTopics] = useState<Set<string>>(new Set());
  const [preloadedTopics, setPreloadedTopics] = useState<Map<string, any[]>>(
    new Map()
  );
  const [preloadingNodes, setPreloadingNodes] = useState<Set<string>>(
    new Set()
  );
  const [zoom, setZoom] = useState(1);
  const [isPhysicsEnabled, setIsPhysicsEnabled] = useState(true);
  const [topics, setTopics] = useState<string[]>(["next1"]);
  const [currTopic, setCurrTopic] = useState<string>("next1");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  // popup + fullscreen states
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [expandedNode, setExpandedNode] = useState<Node | null>(null);
  const [hoverTimer, setHoverTimer] = useState<NodeJS.Timeout | null>(null);
  const lastPositionRef = useRef({ x: 0, y: 0 });
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
    const currentNode = nodes.find((node) => node.isCurrentNode);

    if (currentNode) {
      // Mark the current node as burrowed (removes text and makes it look like a hole)
      setNodes((prev) =>
        prev.map((node) =>
          node.id === currentNode.id
            ? { ...node, isBurrowed: true, isCurrentNode: false }
            : node
        )
      );
    }
    try {
      // Save current state with the burrow applied
      const nodesWithBurrow = nodes.map((node) =>
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
    // reset graph - start with 5 diverse topics
    setNodes([
      {
        id: uuidv4(),
        x: 800,
        y: 800,
        text: "Quantum Physics",
        description:
          "The branch of physics that deals with the behavior of matter and energy at the atomic and subatomic level.",
        level: 0,
        isCurrentNode: false,
      },
      {
        id: uuidv4(),
        x: 1200,
        y: 800,
        text: "Ancient History",
        description:
          "The study of human civilization from the earliest recorded periods to the fall of ancient empires.",
        level: 0,
        isCurrentNode: false,
      },
      {
        id: uuidv4(),
        x: 800,
        y: 1200,
        text: "Culinary Arts",
        description:
          "The art and science of preparing, cooking, and presenting food in creative and delicious ways.",
        level: 0,
        isCurrentNode: false,
      },
      {
        id: uuidv4(),
        x: 1200,
        y: 1200,
        text: "Space Exploration",
        description:
          "The ongoing discovery and exploration of celestial structures in outer space by means of evolving technology.",
        level: 0,
        isCurrentNode: false,
      },
      {
        id: uuidv4(),
        x: 1000,
        y: 1000,
        text: "Music Theory",
        description:
          "The study of the practices and possibilities of music, including harmony, rhythm, and composition.",
        level: 0,
        isCurrentNode: false,
      },
    ]);
    setConnections([]);
    // Center on the middle node (index 4)
    if (nodes.length >= 5) {
      centerOnNode(nodes[4]);
    }
  };
  // Generate AI-powered diverse starting topics
  const generateRandomStartingTopics = async () => {
    try {
      console.log("🤖 Generating AI-powered diverse starting topics...");

      const response = await fetch("/api/explore-topic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: "Random diverse topics",
          journey: [],
          count: 5,
          usedTopics: [], // No used topics for initial generation
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const topics = data.topics || [];

        console.log(
          "✅ AI generated topics:",
          topics.map((t) => t.title)
        );

        // Create 5 AI-generated starting nodes in a pentagon formation
        const centerX = 1000;
        const centerY = 1000;
        const radius = 300;
        const pentagonAngles = [0, 72, 144, 216, 288].map(
          (deg) => (deg * Math.PI) / 180
        );

        const startingNodes: Node[] = topics
          .slice(0, 5)
          .map((topic: any, i: number) => ({
            id: uuidv4(),
            x: centerX + Math.cos(pentagonAngles[i]) * radius,
            y: centerY + Math.sin(pentagonAngles[i]) * radius,
            text: topic.title || `AI Topic ${i + 1}`,
            description:
              topic.description ||
              "An AI-generated diverse topic for exploration.",
            level: 0,
            isCurrentNode: false,
            isClicked: false,
            isBurrowed: false,
          }));

        setNodes(startingNodes);

        // Track the AI-generated topics to prevent duplicates
        const initialTopicTitles = startingNodes.map((node) =>
          node.text.toLowerCase()
        );
        setUsedTopics(new Set(initialTopicTitles));

        console.log(
          "🎯 Initial topics tracked:",
          Array.from(initialTopicTitles)
        );
      } else {
        console.error("❌ API failed - no fallback, AI must work properly");
        throw new Error("Failed to generate initial topics");
      }
    } catch (error) {
      console.error("❌ Error generating AI topics:", error);
      throw new Error(
        "Failed to generate initial topics - AI must work properly"
      );
    }
  };

  // Preload topics for a node on hover
  const preloadTopicsForNode = async (node: Node) => {
    const nodeId = node.id;
    const topicTitle = node.text;

    // Don't preload if already preloading or already preloaded
    if (preloadingNodes.has(nodeId) || preloadedTopics.has(nodeId)) {
      return;
    }

    // Don't preload if node already has children
    const hasChildren = nodes.some((n) => n.parentId === nodeId);
    if (hasChildren) {
      return;
    }

    console.log(`🚀 Preloading topics for: "${topicTitle}"`);
    setPreloadingNodes((prev) => new Set(prev).add(nodeId));

    try {
      const response = await fetch("/api/generate-branches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: topicTitle,
          usedTopics: Array.from(usedTopics),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const topics = data.topics || [];

        console.log(
          `✅ Preloaded ${topics.length} topics for: "${topicTitle}"`
        );

        // Cache the preloaded topics
        setPreloadedTopics((prev) => new Map(prev).set(nodeId, topics));
      } else {
        console.error(`❌ Failed to preload topics for: "${topicTitle}"`);
      }
    } catch (error) {
      console.error(`❌ Error preloading topics for: "${topicTitle}":`, error);
    } finally {
      setPreloadingNodes((prev) => {
        const newSet = new Set(prev);
        newSet.delete(nodeId);
        return newSet;
      });
    }
  };

  // No fallback topics - AI must work properly

  // Generate random starting topics on component mount
  useEffect(() => {
    generateRandomStartingTopics();
  }, []);

  // Global mouse event listeners for node dragging
  useEffect(() => {
    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (isDraggingNode && draggedNodeId) {
        const deltaX = event.clientX - nodeDragStart.x;
        const deltaY = event.clientY - nodeDragStart.y;

        setNodes((prev) =>
          prev.map((n) =>
            n.id === draggedNodeId
              ? { ...n, x: n.x + deltaX / zoom, y: n.y + deltaY / zoom }
              : n
          )
        );

        setNodeDragStart({ x: event.clientX, y: event.clientY });
      }
    };

    const handleGlobalMouseUp = () => {
      handleNodeMouseUp();
    };

    if (isDraggingNode) {
      document.addEventListener("mousemove", handleGlobalMouseMove);
      document.addEventListener("mouseup", handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDraggingNode, draggedNodeId, nodeDragStart, zoom]);

  // Center the canvas on the middle node when component mounts
  useEffect(() => {
    if (nodes.length >= 5) {
      const centerCanvas = () => {
        // Center on the middle node (index 2) for better view of all 5 initial nodes
        centerOnNode(nodes[2]);
      };
      // Center with a small delay to ensure container is rendered
      const timeoutId = setTimeout(centerCanvas, 100);
      // Also center on window resize
      window.addEventListener("resize", centerCanvas);
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener("resize", centerCanvas);
      };
    }
  }, [nodes]);

  // Function to fetch rich summary for a node
  const fetchRichSummary = async (node: Node) => {
    try {
      const response = await fetch("/api/get-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: node.text,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.summary) {
          // Update the node with the rich summary, but preserve original description if API fails
          setNodes((prevNodes) =>
            prevNodes.map((n) =>
              n.id === node.id ? { ...n, richContent: data.summary } : n
            )
          );
        }
      }
    } catch (error) {
      console.error("Error fetching rich summary:", error);
    }
  };

  // Extract node creation logic for reuse
  const createNodesFromTopics = async (
    parentNode: Node,
    topics: Array<{ title: string; description: string }>
  ) => {
    // Filter out duplicate topics and ensure we have exactly 5 unique topics
    const uniqueTopics = topics.filter((topic) => {
      const topicTitle = topic.title.toLowerCase();
      return !usedTopics.has(topicTitle);
    });

    // Add new topics to used topics set
    const newTopicTitles = uniqueTopics.map((topic) =>
      topic.title.toLowerCase()
    );
    setUsedTopics((prev) => new Set([...prev, ...newTopicTitles]));

    // If we don't have exactly 5 topics, the AI failed - throw error
    if (uniqueTopics.length < 5) {
      throw new Error(
        `AI only generated ${uniqueTopics.length} topics instead of 5 - must generate exactly 5 topics`
      );
    }

    // Use the filtered unique topics
    const finalTopics = uniqueTopics.slice(0, 5);

    // ORGANIZED LAYOUT SYSTEM
    const newNodes: Node[] = [];
    const newConnections: { from: string; to: string }[] = [];

    // Perfect spacing constants - CLUSTERED around parent
    const BASE_RADIUS = 250; // Closer to parent for better clustering
    const MIN_DISTANCE = 150; // Minimum distance between any two nodes

    // Get all existing node positions for collision detection
    const existingPositions = nodes.map((n) => ({ x: n.x, y: n.y }));

    // Calculate optimal positions for 5 nodes in a perfect pentagon
    const positions = calculateOptimalPositions(
      parentNode.x,
      parentNode.y,
      BASE_RADIUS,
      existingPositions,
      MIN_DISTANCE
    );

    // Create exactly 5 nodes with perfect positioning
    for (let i = 0; i < 5; i++) {
      const position = positions[i];
      const newNode: Node = {
        id: uuidv4(),
        x: position.x,
        y: position.y,
        text: finalTopics[i]?.title || `Topic ${i + 1}`,
        description:
          finalTopics[i]?.description ||
          `A related concept to explore further.`,
        richContent: finalTopics[i]?.richContent,
        level: parentNode.level + 1,
        parentId: parentNode.id,
        isClicked: false,
        isCurrentNode: false,
        isBurrowed: false,
      };
      newNodes.push(newNode);
      newConnections.push({ from: parentNode.id, to: newNode.id });
    }

    // Update state
    setNodes((prev: Node[]) => [...prev, ...newNodes]);
    setConnections((prev) => [...prev, ...newConnections]);

    // Center the view on the parent node
    setTimeout(() => centerOnNode(parentNode), 100);
  };

  const generateNewNodes = async (parentNode: Node) => {
    setIsGenerating(true);

    // Check if we have preloaded topics for this node
    const preloaded = preloadedTopics.get(parentNode.id);
    if (preloaded && preloaded.length > 0) {
      console.log(`⚡ Using preloaded topics for: "${parentNode.text}"`);
      const topics = preloaded;

      // Remove from preloaded cache since we're using them
      setPreloadedTopics((prev) => {
        const newMap = new Map(prev);
        newMap.delete(parentNode.id);
        return newMap;
      });

      // Use the preloaded topics directly
      await createNodesFromTopics(parentNode, topics);
      setIsGenerating(false);
      return;
    }

    // Generate topics from API with journey context
    let topics: Array<{ title: string; description: string }> = [];
    try {
      // Build journey path for context
      const journeyPath = [];
      let currentNode = parentNode;
      while (currentNode && journeyPath.length < 5) {
        journeyPath.unshift(currentNode.text);
        currentNode = nodes.find((n) => n.id === currentNode.parentId);
      }

      const response = await fetch("/api/generate-branches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: parentNode.text,
          usedTopics: Array.from(usedTopics), // Pass used topics to avoid duplicates
        }),
      });

      if (response.ok) {
        const data = await response.json();
        topics = data.topics || [];
      } else {
        console.error("Failed to generate topics:", response.statusText);
      }
    } catch (error) {
      console.error("Error generating topics:", error);
    }

    // Use the extracted node creation logic
    await createNodesFromTopics(parentNode, topics);
    setIsGenerating(false);
  };

  // PERFECT POSITIONING ALGORITHM
  const calculateOptimalPositions = (
    centerX: number,
    centerY: number,
    radius: number,
    existingPositions: { x: number; y: number }[],
    minDistance: number
  ): { x: number; y: number }[] => {
    const positions: { x: number; y: number }[] = [];

    // Start with a perfect pentagon (5 points)
    const pentagonAngles = [0, 72, 144, 216, 288].map(
      (deg) => (deg * Math.PI) / 180
    );

    for (let i = 0; i < 5; i++) {
      let bestPosition = {
        x: centerX + Math.cos(pentagonAngles[i]) * radius,
        y: centerY + Math.sin(pentagonAngles[i]) * radius,
      };

      // Check for collisions and adjust if needed
      let attempts = 0;
      while (attempts < 10) {
        let hasCollision = false;

        // Check against existing positions
        for (const existing of existingPositions) {
          const distance = Math.sqrt(
            Math.pow(bestPosition.x - existing.x, 2) +
              Math.pow(bestPosition.y - existing.y, 2)
          );
          if (distance < minDistance) {
            hasCollision = true;
            break;
          }
        }

        // Check against already calculated positions
        for (const pos of positions) {
          const distance = Math.sqrt(
            Math.pow(bestPosition.x - pos.x, 2) +
              Math.pow(bestPosition.y - pos.y, 2)
          );
          if (distance < minDistance) {
            hasCollision = true;
            break;
          }
        }

        if (!hasCollision) break;

        // Adjust position by moving slightly outward and rotating
        const adjustmentAngle = attempts * 0.5 + pentagonAngles[i];
        const adjustmentRadius = radius + attempts * 50;
        bestPosition = {
          x: centerX + Math.cos(adjustmentAngle) * adjustmentRadius,
          y: centerY + Math.sin(adjustmentAngle) * adjustmentRadius,
        };
        attempts++;
      }

      positions.push(bestPosition);
    }

    return positions;
  };
  // Handle node drag start
  const handleNodeMouseDown = (node: Node, event: React.MouseEvent) => {
    event.stopPropagation();
    setIsDraggingNode(true);
    setDraggedNodeId(node.id);
    setNodeDragStart({ x: event.clientX, y: event.clientY });
  };

  // Handle node drag end
  const handleNodeMouseUp = () => {
    setIsDraggingNode(false);
    setDraggedNodeId(null);
  };

  const handleNodeClick = async (node: Node, event: React.MouseEvent) => {
    if (isDragging || isDraggingNode) return;

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
          prev.map((n) => {
            // Find siblings (nodes with same parent)
            const isSibling = n.parentId === node.parentId && n.id !== node.id;

            return {
              ...n,
              isClicked: n.isCurrentNode ? true : n.isClicked, // Previous current becomes grey (clicked)
              isCurrentNode: n.id === node.id, // This blue node becomes current (beige)
              isFaded: isSibling ? true : n.isFaded, // Fade siblings of the clicked node
            };
          })
        );
      }
      // Fetch rich summary for the clicked node
      await fetchRichSummary(node);

      // Generate children if they don't exist
      const hasChildren = nodes.some((n) => n.parentId === node.id);
      if (!hasChildren) {
        await generateNewNodes(node);
      }
    }
  };
  const handleMouseDown = (event: React.MouseEvent) => {
    // Only start canvas dragging if we're not dragging a node
    if (!isDraggingNode) {
      setIsDragging(true);
      setDragStart({ x: event.clientX, y: event.clientY });
      setLastOffset(canvasOffset);
    }
  };
  const handleMouseMove = (event: React.MouseEvent) => {
    if (isDragging && !isDraggingNode) {
      const deltaX = event.clientX - dragStart.x;
      const deltaY = event.clientY - dragStart.y;
      setCanvasOffset({
        x: lastOffset.x + deltaX,
        y: lastOffset.y + deltaY,
      });
    }
  };

  // Simple throttle function for popup mouse tracking
  function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean = false;
    return function (this: any, ...args: Parameters<T>): void {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  // Throttled mouse move handler for popup positioning
  const handlePopupMouseMove = useCallback(
    throttle((e: React.MouseEvent) => {
      if (showPopup) {
        const newX = e.clientX + 20;
        const newY = e.clientY - 50;

        if (
          Math.abs(newX - lastPositionRef.current.x) > 5 ||
          Math.abs(newY - lastPositionRef.current.y) > 5
        ) {
          const position = { x: newX, y: newY };
          lastPositionRef.current = position;
          setPopupPosition(position);
        }
      }
    }, 16),
    [showPopup]
  );

  const handleNodeMouseEnter = useCallback(
    (e: React.MouseEvent, node: Node) => {
      // Show popup for all nodes except burrowed ones
      if (!node.isBurrowed) {
        const position = {
          x: e.clientX + 20,
          y: e.clientY - 50,
        };

        lastPositionRef.current = position;
        setPopupPosition(position);
        setHoveredNode(node);
        setShowPopup(true);

        // Start preloading topics for this node
        preloadTopicsForNode(node);
      }
    },
    [preloadTopicsForNode]
  );

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
    setShowPopup(false);
  }, []);
  const handleMouseUp = () => {
    setIsDragging(false);
    handleNodeMouseUp();
  };
  const handleMouseLeave = () => {
    setIsDragging(false);
    handleNodeMouseUp();
  };
  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY;
    const zoomFactor = 0.1;
    const newZoom = Math.max(
      0.1,
      Math.min(10, zoom + (delta > 0 ? -zoomFactor : zoomFactor))
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

  // Handle popup visibility with smooth transition
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (showPopup) {
      timeout = setTimeout(() => {
        setPopupVisible(true);
      }, 10);
    } else {
      setPopupVisible(false);
    }
    return () => clearTimeout(timeout);
  }, [showPopup]);
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
  // Function to get node style based on state
  const getNodeStyle = (node: Node) => {
    if (node.isBurrowed) {
      // Burrow appearance - brown hole-like style with no text
      return {
        background:
          "radial-gradient(circle at center, #8B4513 0%, #654321 60%, #3D2B1F 100%)",
        boxShadow: "inset 0 -8px 20px rgba(0,0,0,0.6)",
        transform: "perspective(300px) rotateX(45deg)",
      };
    } else if (node.isCurrentNode) {
      return { backgroundColor: "#D2B48C" }; // Beige for current node
    } else if (node.isClicked) {
      return { backgroundColor: "#808080" }; // Grey for previously visited nodes
    } else if (node.isFaded) {
      return {
        backgroundColor: "#0114FF", // Blue for unvisited nodes
        opacity: 0.3, // Fade the node
        transform: "scale(0.8)", // Make it slightly smaller
      };
    } else if (preloadingNodes.has(node.id)) {
      return {
        backgroundColor: "#0114FF", // Blue for unvisited nodes
        boxShadow: "0 0 20px #FFD700", // Golden glow for preloading
        animation: "pulse 1.5s infinite",
      };
    } else if (preloadedTopics.has(node.id)) {
      return {
        backgroundColor: "#0114FF", // Blue for unvisited nodes
        boxShadow: "0 0 15px #00FF00", // Green glow for preloaded
      };
    } else {
      return { backgroundColor: "#0114FF" }; // Blue for unvisited nodes
    }
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
        setZoom((prev) => Math.min(10, prev + 0.05));
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
        {isGenerating && (
          <div className="px-4 py-2 bg-yellow-500 text-white rounded-lg shadow-lg text-sm font-medium animate-pulse">
            Generating topics...
          </div>
        )}
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
        onMouseMove={(e) => {
          handleMouseMove(e);
          handlePopupMouseMove(e);
        }}
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
          {/* Render connections */}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: "200vw", height: "200vh" }}
          >
            {connections.map((connection, index) => {
              const fromNode = nodes.find((n) => n.id === connection.from);
              const toNode = nodes.find((n) => n.id === connection.to);

              if (!fromNode || !toNode) return null;

              return (
                <line
                  key={`${connection.from}-${connection.to}`}
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke="#0114FF"
                  strokeWidth="2"
                  opacity={toNode.isFaded ? "0.2" : "0.8"}
                />
              );
            })}
          </svg>

          {/* Render nodes */}
          {nodes.map((node) => (
            <div
              key={node.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                isDraggingNode && draggedNodeId === node.id
                  ? "cursor-grabbing scale-110 z-50"
                  : "cursor-grab hover:scale-110"
              }`}
              style={{
                left: node.x,
                top: node.y,
              }}
              onMouseDown={(e) => handleNodeMouseDown(node, e)}
              onClick={(e) => handleNodeClick(node, e)}
              onMouseEnter={(e) => handleNodeMouseEnter(e, node)}
              onMouseLeave={handleNodeMouseLeave}
            >
              <div
                className={`w-24 h-24 rounded-full text-[#fff0d2] flex items-center justify-center text-sm font-bold transition-all duration-300 relative overflow-hidden ${
                  isDraggingNode && draggedNodeId === node.id
                    ? "shadow-2xl ring-4 ring-yellow-400 ring-opacity-50"
                    : "shadow-lg hover:shadow-xl"
                }`}
                style={{
                  ...getNodeStyle(node),
                  animation:
                    node.level === 0 ? "none" : "nodeAppear 0.5s ease-out",
                }}
              >
                {/* Only show text if not burrowed */}
                {!node.isBurrowed && (
                  <div className="w-full h-full flex items-center justify-center p-2">
                    <div className="text-center leading-tight w-full">
                      <div className="text-xs leading-tight">
                        {node.text.split(" ").map((word, i) => (
                          <div key={i} className="truncate">
                            {word}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
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

        .pop-animation {
          opacity: 1;
          transform: scale(1);
          animation: popIn 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28);
        }

        @keyframes popIn {
          0% {
            opacity: 0;
            transform: scale(0.95) translateY(5px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes pulse {
          0% {
            box-shadow: 0 0 20px #ffd700;
          }
          50% {
            box-shadow: 0 0 30px #ffd700, 0 0 40px #ffd700;
          }
          100% {
            box-shadow: 0 0 20px #ffd700;
          }
        }
      `}</style>
      {/* Enhanced Hover popup - matching website-v3 exactly */}
      {hoveredNode && (
        <div
          className={`fixed z-50 w-[max(25vw,300px)] rounded-2xl shadow-2xl pointer-events-none transition-all duration-300 ${
            popupVisible
              ? "pop-animation"
              : "opacity-0 scale-95 origin-bottom-left"
          }`}
          style={{
            left: `${popupPosition.x}px`,
            top: `${popupPosition.y + 50}px`,
            transformOrigin: "top left",
            transition:
              "left 0.1s ease-out, top 0.1s ease-out, opacity 0.2s ease, transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)",
          }}
        >
          <div
            className="relative min-h-[max(15vw,180px)] w-full overflow-visible rounded-2xl border-2"
            style={{
              backgroundColor: hoveredNode.isCurrentNode
                ? "#D2B48C"
                : hoveredNode.isClicked
                ? "#808080"
                : hoveredNode.isFaded
                ? "#fff0d2"
                : "#fff0d2",
              borderColor: hoveredNode.isCurrentNode
                ? "#D2B48C"
                : hoveredNode.isClicked
                ? "#808080"
                : hoveredNode.isFaded
                ? "#0114FF"
                : "#0114FF",
              opacity: hoveredNode.isFaded ? 0.6 : 1,
            }}
            role="img"
            aria-label={hoveredNode.text}
          >
            <div
              className="relative z-10 p-4 min-h-full flex flex-col justify-start"
              style={{
                color: hoveredNode.isCurrentNode
                  ? "#fff0d2"
                  : hoveredNode.isClicked
                  ? "#fff0d2"
                  : hoveredNode.isFaded
                  ? "#0114FF"
                  : "#0114FF",
              }}
            >
              <h3 className="font-bold text-2xl mb-2 break-words">
                {hoveredNode.text}
              </h3>
              <p className="text-sm font-medium opacity-90 mb-3">
                Level {hoveredNode.level} •{" "}
                {hoveredNode.isCurrentNode
                  ? "Current"
                  : hoveredNode.isClicked
                  ? "Visited"
                  : hoveredNode.isFaded
                  ? "Faded"
                  : "Unvisited"}
              </p>
              <p className="text-base opacity-90 leading-relaxed break-words">
                {hoveredNode.description || "No description available."}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Fullscreen expanded */}
      {expandedNode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white w-[90%] max-w-4xl h-[90%] rounded-lg shadow-xl p-8 relative overflow-y-auto">
            <button
              onClick={() => setExpandedNode(null)}
              className="absolute top-4 right-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
            >
              Close
            </button>
            <h2 className="text-3xl font-bold mb-6 pr-20">
              {expandedNode.text}
            </h2>
            <div className="text-gray-700 text-lg leading-relaxed mb-6">
              {expandedNode.description || "No description available."}
            </div>
            <div className="text-gray-500 text-sm">
              Level {expandedNode.level} •{" "}
              {expandedNode.isCurrentNode
                ? "Current Node"
                : expandedNode.isClicked
                ? "Previously Visited"
                : "Unvisited"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
